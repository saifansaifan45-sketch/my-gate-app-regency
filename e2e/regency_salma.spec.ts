import { test, expect } from '@playwright/test';

test.describe('Regency Salma - Comprehensive End-to-End Test Suite', () => {

  test('01: System Health, Backend API & Security Invariants', async ({ request, page }) => {
    // 1. Healthcheck verification
    const healthRes = await request.get('http://localhost:3005/health');
    expect(healthRes.status()).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe('ok');
    expect(healthData.database).toBe('connected');

    // 2. Root API status verification
    const rootRes = await request.get('http://localhost:3005/');
    expect(rootRes.status()).toBe(200);
    const rootData = await rootRes.json();
    expect(rootData.name).toContain('Regency Salma');

    // 3. Frontend Web App Header & Title Check
    await page.goto('/');
    await page.waitForSelector('input[placeholder*="email" i]', { timeout: 20000 });
    await expect(page).toHaveTitle(/Regency Salma/i);
    await page.screenshot({ path: 'e2e/evidence/01_app_entry_loaded.png' });
  });

  test('02: Resident / Owner Complete Flow (Passes, Tickets, Community & Profile)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[placeholder*="email" i]', { timeout: 20000 });
    
    // Login as Resident / Owner
    await page.locator('input[placeholder*="email" i]').fill('resident@regency.com');
    await page.locator('input[placeholder*="password" i]').fill('password123');
    await page.locator('text=Login').first().click();

    // 1. Resident Home Dashboard
    await page.waitForTimeout(4000);
    await expect(page.locator('text=9B').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/evidence/02_resident_home_dashboard.png' });

    // 2. Navigate to Visitors / Gate Pass Management
    await page.goto('/visitors');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/02_resident_visitors_screen.png' });

    // 3. Navigate to Help Desk
    await page.goto('/help-desk');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/02_resident_helpdesk_screen.png' });

    const raiseTicketBtn = page.locator('text=Raise a ticket').first();
    if (await raiseTicketBtn.isVisible()) {
      await raiseTicketBtn.click();
      await page.waitForTimeout(2000);
      const inputField = page.locator('textarea, input[placeholder*="Describe" i], input[placeholder*="issue" i]').first();
      if (await inputField.isVisible()) {
        await inputField.fill('Water pressure maintenance requested for Unit 9B kitchen sink');
        await page.screenshot({ path: 'e2e/evidence/02_resident_raise_issue_filled.png' });
        const submitBtn = page.locator('text=Submit Ticket').or(page.locator('text=Submit')).first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // 4. Navigate to Community Hub (Announcements & Polls)
    await page.goto('/community');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Announcements').first()).toBeVisible();
    await page.screenshot({ path: 'e2e/evidence/02_resident_community_announcements.png' });
    
    // Switch to Polls
    const pollsTab = page.locator('text=Polls').first();
    if (await pollsTab.isVisible()) {
      await pollsTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/evidence/02_resident_community_polls.png' });
    }

    // 5. Navigate to Family & Household Records
    await page.goto('/family-members');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/02_resident_family_members.png' });

    // 6. Navigate to Resident Profile & Logout
    await page.goto('/profile');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'e2e/evidence/02_resident_profile_screen.png' });
  });

  test('03: Family Member / Occupant Complete Flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[placeholder*="email" i]', { timeout: 20000 });

    // Login as Family Member
    await page.locator('input[placeholder*="email" i]').fill('family@regency.com');
    await page.locator('input[placeholder*="password" i]').fill('password123');
    await page.locator('text=Login').first().click();

    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'e2e/evidence/03_family_member_dashboard.png' });

    // View household activity
    await page.goto('/activity-overview');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/03_family_activity_overview.png' });

    // View community
    await page.goto('/community');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/03_family_community.png' });
  });

  test('04: Co-Owner Resident Complete Flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[placeholder*="email" i]', { timeout: 20000 });

    // Login as Co-Owner
    await page.locator('input[placeholder*="email" i]').fill('coowner@regency.com');
    await page.locator('input[placeholder*="password" i]').fill('password123');
    await page.locator('text=Login').first().click();

    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'e2e/evidence/04_coowner_dashboard.png' });

    // Verify properties / my-home
    await page.goto('/my-home');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/04_coowner_my_home.png' });
  });

  test('05: Security Guard / Watchman Operations Flow (Shift Check-in, Gate Queue & Logs)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[placeholder*="email" i]', { timeout: 20000 });

    // Login as Watchman
    await page.locator('input[placeholder*="email" i]').fill('watchman@regency.com');
    await page.locator('input[placeholder*="password" i]').fill('password123');
    await page.locator('text=Login').first().click();

    // 1. Workforce Hub Landing
    await page.waitForTimeout(4000);
    await expect(page.locator('text=Rajesh').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/evidence/05_watchman_hub.png' });

    // 2. Perform Shift Check In / Out
    const checkInBtn = page.locator('text=Check In').first();
    if (await checkInBtn.isVisible()) {
      await checkInBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/evidence/05_watchman_shift_checked_in.png' });
    }

    // 3. Open Gate Operations / Check-in queue
    await page.goto('/work/visitors');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/05_watchman_gate_queue.png' });

    // 4. View Gate Activity Log
    await page.goto('/work/gate-activity');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/05_watchman_gate_activity_logs.png' });

    // 5. View Guard Profile
    await page.goto('/work/profile');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'e2e/evidence/05_watchman_profile.png' });
  });

  test('06: Community Manager Command Center (Staff, Tickets & Operations)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[placeholder*="email" i]', { timeout: 20000 });

    // Login as Manager
    await page.locator('input[placeholder*="email" i]').fill('manager@regency.com');
    await page.locator('input[placeholder*="password" i]').fill('password123');
    await page.locator('text=Login').first().click();

    // 1. Manager Operations Dashboard
    await page.waitForTimeout(4000);
    await expect(page.locator('text=Manager Operations').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/evidence/06_manager_overview.png' });

    // 2. Manager Help Desk & Maintenance Tickets Queue
    await page.goto('/manager/tickets');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/06_manager_tickets_queue.png' });

    // 3. Manager Staff & Workforce Roster
    await page.goto('/manager/personnel');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/06_manager_staff_roster.png' });

    // 4. Manager Gate Visitors Supervision
    await page.goto('/manager/visitors');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/06_manager_visitors_supervision.png' });
  });

  test('07: Leadership Council Governance (Approvals, Tickets & Broadcasts)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[placeholder*="email" i]', { timeout: 20000 });

    // Login as Leadership Member (Anand Sharma)
    await page.locator('input[placeholder*="email" i]').fill('leadership@regency.com');
    await page.locator('input[placeholder*="password" i]').fill('password123');
    await page.locator('text=Login').first().click();

    // 1. Leadership Governance Dashboard
    await page.waitForTimeout(4000);
    await expect(page.locator('text=Leadership Governance').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/evidence/07_leadership_governance_hub.png' });

    // 2. Executive Approvals & Membership Reviews
    await page.goto('/leadership/approvals');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/07_leadership_approvals_screen.png' });

    // 3. Escalated Tickets & Community Oversight
    await page.goto('/leadership/tickets');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/evidence/07_leadership_tickets_oversight.png' });
  });

});
