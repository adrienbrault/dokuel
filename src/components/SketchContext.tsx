import { createContext, useContext } from "react";

const SketchContext = createContext(false);

export function SketchProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <SketchContext.Provider value={enabled}>{children}</SketchContext.Provider>
  );
}

export function useSketch() {
  return useContext(SketchContext);
}
