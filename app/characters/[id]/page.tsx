import { Suspense } from "react";
import CharacterDetail from "./character-detail";

export default function CharacterDetailPage() {
  return (
    <Suspense>
      <CharacterDetail />
    </Suspense>
  );
}
