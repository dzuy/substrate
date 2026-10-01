import { defineRailway, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "substrate";

export default defineRailway(() => {
  const substrate = service("substrate", {
    build: "npm run build:web",
    start: "npm run start:production",
    healthcheck: "/healthz",
    healthcheckTimeout: 120,
    // builder from CaC: "RAILPACK"
  });
  return project("Substrate", {
    resources: [substrate],
  });
});
