export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  return new Response(JSON.stringify({ ok: true, edge: true }), {
    headers: { 'content-type': 'application/json' },
  });
}
