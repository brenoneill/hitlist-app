/**
 * Happy path against `npm run dev:e2e` (AUTH_E2E + PGlite seed).
 * Exemplar for contributor flow tests — no real GitHub/agent credentials.
 */
describe("hitlist happy path", () => {
  it("signs in, shows seeded marks, opens workspace, and creates a mark", () => {
    cy.visit("/api/auth/signin");
    cy.contains("button", "Sign in with E2E test user").click();

    // `/` sends users without a provider key to settings; the list lives on /app.
    cy.visit("/app");
    cy.contains("Add dark mode toggle to settings").should("be.visible");
    cy.contains("Fix drag handle hit area on mobile").should("be.visible");

    cy.contains(
      "Have the repos collapsed by default instead of folded up (in settings page)",
    ).should("be.visible");
    cy.get('a[href="/app/task/e2e-3?tab=pr"]').click();
    cy.url().should("include", "/app/task/e2e-3");
    cy.contains('[role="tab"]', "Agent").should("be.visible");
    cy.contains('[role="tab"]', "PR").should("be.visible");

    cy.visit("/app");
    const title = `E2E mark ${Date.now()}`;
    cy.get('input[placeholder="(-- repo, #dispatch)"]').type(title);
    cy.contains("button", "Mark").click();
    cy.contains(title).should("be.visible");
  });
});
