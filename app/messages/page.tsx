import { Suspense } from "react";
import Messages from "./messages";

export default function MessagesPage() {
  return (
    <Suspense>
      <Messages />
    </Suspense>
  );
}
