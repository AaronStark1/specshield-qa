import { Suspense, lazy } from "react";
import { usePath } from "./lib/router.tsx";

const Landing = lazy(() => import("./pages/Landing.tsx"));
const Studio = lazy(() => import("./pages/Studio.tsx"));

function isStudioPath(path: string): boolean {
  return path === "/studio" || path.startsWith("/studio/");
}

export default function App() {
  const studio = isStudioPath(usePath());
  return (
    <Suspense fallback={<div className={studio ? "min-h-screen bg-canvas" : "min-h-screen bg-black"} />}>
      {studio ? <Studio /> : <Landing />}
    </Suspense>
  );
}
