import React from "react";
import StatusMessage from "../UIC/StatusMessage";

export default function NotFound() {
  return (
    <div className="container py-5">
      <StatusMessage icon="🧭" title="Page not found" message="Looks like you took a wrong turn." action={{ to: "/", label: "Go home" }} />
    </div>
  );
}
