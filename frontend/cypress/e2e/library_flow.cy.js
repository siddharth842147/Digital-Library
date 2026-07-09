describe('Library User Flow', () => {
  it('Loads the homepage', () => {
    cy.visit('/');
    cy.contains('Digital Library');
    cy.contains('Login');
  });

  it('Navigates to login page', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.contains('button', 'Login').should('be.visible');
  });

  it('Shows validation error on empty login', () => {
    cy.visit('/login');
    cy.contains('button', 'Login').click();
    // Toast error should appear, or HTML5 validation should trigger
    // Depends on the exact implementation, but usually:
    cy.get('input:invalid').should('have.length', 2);
  });
});
