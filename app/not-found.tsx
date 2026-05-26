// Force dynamic rendering to avoid RSC prerender issue
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "4rem" }}>
      <h1>404</h1>
      <p>Page not found</p>
      <a href="/">← Home</a>
    </div>
  );
}
