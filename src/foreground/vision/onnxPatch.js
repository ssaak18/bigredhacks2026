import { env } from "@huggingface/transformers";

/**
 * The published OWL-ViT ONNX export normalises class embeddings through a float64 `Cast`, which
 * onnxruntime-web's WASM backend does not implement ("Could not find an implementation for
 * Cast(13) node '/class_head/Cast'"). The graph only uses that double for a masked-fill constant,
 * so rewriting those few tensors to float32 is lossless. Every edit keeps the byte length the same,
 * so the protobuf stays valid without re-encoding the 150 MB file.
 */
const text = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const EDITS = [
  // Cast node: `to` attribute 11 (double) -> 1 (float)
  ['/class_head/Cast"\x04Cast*\t\n\x02to\x18\x0b', '/class_head/Cast"\x04Cast*\t\n\x02to\x18\x01'],
  // Constant_11: the double scalar -1e6 -> float32 -1e6 (raw_data shrinks by 4 bytes, padded with an ignored doc_string)
  ["\x10\x0bJ\x08\x00\x00\x00\x00\x80\x84.\xc1", "\x10\x01J\x04\x00\x24\x74\xc9\x62\x02\x20\x20"],
  // Declared tensor types of the three affected values
  ["/class_head/Cast_output_0\x12\x04\n\x02\x08\x0b", "/class_head/Cast_output_0\x12\x04\n\x02\x08\x01"],
  ["/class_head/Constant_11_output_0\x12\x06\n\x04\x08\x0b", "/class_head/Constant_11_output_0\x12\x06\n\x04\x08\x01"],
  ["/class_head/Where_output_0\x12\x04\n\x02\x08\x0b", "/class_head/Where_output_0\x12\x04\n\x02\x08\x01"],
].map(([from, to]) => [text(from), text(to)]);

function indexOf(bytes, needle) {
  const last = bytes.length - needle.length;
  outer: for (let i = bytes.indexOf(needle[0]); i !== -1 && i <= last; i = bytes.indexOf(needle[0], i + 1)) {
    for (let j = 1; j < needle.length; j += 1) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** Rewrites the float64 nodes in place. Safe to run on an already-patched or unrelated file. */
export function patchOwlGraph(bytes) {
  for (const [from, to] of EDITS) {
    const at = indexOf(bytes, from);
    if (at !== -1) bytes.set(to, at);
  }
  return bytes;
}

const isOwlGraph = (url) => /owlvit.*\.onnx(\?|$)/.test(String(url));

async function patchedResponse(response) {
  const bytes = patchOwlGraph(new Uint8Array(await response.arrayBuffer()));
  const headers = new Headers(response.headers);
  headers.set("content-length", String(bytes.byteLength));
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers });
}

/**
 * Makes OWL-ViT loadable by onnxruntime-web: patches the graph on download and when it is read
 * back from the browser cache (which may hold an older, unpatched copy). No-op outside browsers.
 */
export function installOwlPatch() {
  if (typeof caches === "undefined" || env.useCustomCache) return;

  const nativeFetch = env.fetch ?? globalThis.fetch.bind(globalThis);
  env.fetch = async (url, init) => {
    const response = await nativeFetch(url, init);
    return response.ok && isOwlGraph(url) ? patchedResponse(response) : response;
  };

  const opened = caches.open(env.cacheKey);
  env.useCustomCache = true;
  env.customCache = {
    async match(request) {
      const response = await (await opened).match(request);
      return response && isOwlGraph(request) ? patchedResponse(response) : response;
    },
    async put(request, response) {
      await (await opened).put(request, response);
    },
    async delete(request) {
      return (await opened).delete(request);
    },
  };
}
