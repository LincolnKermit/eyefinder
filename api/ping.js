export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  return new Response(JSON.stringify({ ok: true, runtime: 'edge' }), {
    headers: { 'content-type': 'application/json' },
  });
}
