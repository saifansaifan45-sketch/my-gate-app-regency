import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, letter[1] - 36, "Regency Salma (Zobay Neighbourhood) — Architecture & System Specification")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)
            
        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — SYSTEM SPECIFICATION V0.0.1")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, letter[0] - 54, 48)
        self.restoreState()

def build_pdf(filename="Regency_Salma_Comprehensive_Architecture_Document.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#0F172A")    # Slate 900
    brand_emerald = colors.HexColor("#047857")    # Emerald 700
    accent_blue   = colors.HexColor("#2563EB")    # Blue 600
    text_dark     = colors.HexColor("#1E293B")    # Slate 800
    text_muted    = colors.HexColor("#475569")    # Slate 600
    bg_light      = colors.HexColor("#F8FAFC")    # Slate 50

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=brand_emerald,
        spaceAfter=15
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_muted,
        spaceAfter=20
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=brand_emerald,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=text_dark,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=text_dark
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=primary_color
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A")
    )

    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#065F46")
    )

    story = []

    # Title & Header
    story.append(Paragraph("REGENCY SALMA / ZOBAY NEIGHBOURHOOD", title_style))
    story.append(Paragraph("Complete Technical Architecture, Stack Breakdown & Domain Hierarchy Specification", subtitle_style))
    story.append(Paragraph("<b>Document Version:</b> 1.0.0 &nbsp;|&nbsp; <b>Baseline Commit:</b> origin/main@5976a96 (v0.0.1) &nbsp;|&nbsp; <b>Scope:</b> Architecture, Roles, Stack, Data Model & Security Invariants", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_emerald, spaceBefore=0, spaceAfter=14))

    # Section 1: Executive Overview
    story.append(Paragraph("1. Executive Summary & Vision", h1_style))
    story.append(Paragraph(
        "<b>Regency Salma (commercialized as Zobay Neighbourhood)</b> is an enterprise residential community operating system. "
        "Unlike legacy gated community management tools that treat flat ownership and user accounts as simple strings or single-role entries, "
        "Regency Salma was engineered around a core architectural axiom: <b>Identity ≠ Authorization</b>. "
        "A single real-world human being (User) can simultaneously be an <b>Owner</b> of Unit 9A, a <b>Tenant/Resident</b> of Unit 4B, and an elected member of the <b>Leadership Council</b>. "
        "Every permission, pass, gate access check, and chat privilege is dynamically derived from verified multi-table relationships rather than a static role flag.",
        body_style
    ))
    story.append(Paragraph(
        "The project was recovered from a legacy prototype into a mathematically strict, deterministic architecture featuring <b>34 relational database tables</b>, "
        "zero un-migrated schema mutations (strict <i>migrate deploy</i>, no <i>db push</i>), strict token-versioning security, full offline/online state reconciliation, "
        "and multi-role workflow support across mobile and web interfaces.",
        body_style
    ))

    # Section 2: Technology Stack & Architectural Purpose
    story.append(Spacer(1, 8))
    story.append(Paragraph("2. Complete Technology Stack & Purpose Matrix", h1_style))
    story.append(Paragraph("Every library and technology in Regency Salma was selected to enforce determinism, security, and low-latency mobile/web responsiveness:", body_style))

    tech_data = [
        [Paragraph("Technology", table_header_style), Paragraph("Category", table_header_style), Paragraph("Exact Role & Architectural Purpose in Project", table_header_style)],
        
        [Paragraph("<b>Expo Router 57</b>", table_cell_bold), Paragraph("Mobile / Web Framework", table_cell_style), 
         Paragraph("File-based routing for universal apps. Powers simultaneous native deployment (iOS/Android) and zero-config Web application execution via <code>metro-bundler</code>.", table_cell_style)],
        
        [Paragraph("<b>React Native 0.86 & React 19</b>", table_cell_bold), Paragraph("Frontend Core", table_cell_style), 
         Paragraph("Cross-platform mobile UI runtime delivering 60fps animations, native haptic integration, safe-area boundary management, and responsive layouts across phones, tablets, and desktop browsers.", table_cell_style)],
        
        [Paragraph("<b>Node.js 20+ & Express 5</b>", table_cell_bold), Paragraph("Backend API", table_cell_style), 
         Paragraph("High-throughput RESTful routing and middleware pipeline with async error handling, custom security cascades, rate limiting, and structured JSON responses.", table_cell_style)],
         
        [Paragraph("<b>Prisma ORM 7.9+ / 7.10</b>", table_cell_bold), Paragraph("Data Access Layer", table_cell_style), 
         Paragraph("Type-safe database ORM managing relational constraints, atomic transactions ($transaction), and strictly tracked SQL migrations (<code>prisma/migrations</code>).", table_cell_style)],
         
        [Paragraph("<b>PostgreSQL 16</b>", table_cell_bold), Paragraph("Relational DB", table_cell_style), 
         Paragraph("ACID-compliant primary datastore with 34 relational tables, multi-column uniqueness indexes, foreign keys, and audit logging for security gate passes.", table_cell_style)],
         
        [Paragraph("<b>JWT & TokenVersion</b>", table_cell_bold), Paragraph("Authentication", table_cell_style), 
         Paragraph("Dual-token auth (Access + Refresh). Includes database-backed <code>tokenVersion</code> to allow instant global session revocation when credentials or roles change.", table_cell_style)],
         
        [Paragraph("<b>TanStack React Query 5</b>", table_cell_bold), Paragraph("State Management", table_cell_style), 
         Paragraph("Server-state caching, background revalidation, optimistic mutations, and automated cache invalidation upon gate check-ins or visitor approvals.", table_cell_style)],
         
        [Paragraph("<b>Zod 4</b>", table_cell_bold), Paragraph("Validation", table_cell_style), 
         Paragraph("Runtime schema enforcement on API payloads (e.g., verifying mandatory <code>purpose</code> on visitor requests and 6-digit numeric OTP formatting).", table_cell_style)],
         
        [Paragraph("<b>WebSockets & Polling</b>", table_cell_bold), Paragraph("Real-Time Comms", table_cell_style), 
         Paragraph("Bi-directional real-time chat, security gate alerts, and instant resident notification for arriving guests and courier deliveries.", table_cell_style)],
         
        [Paragraph("<b>Docker Containerization</b>", table_cell_bold), Paragraph("Infrastructure", table_cell_style), 
         Paragraph("Isolated, reproducible execution of PostgreSQL with volume persistence and environmental portability across dev, staging, and production.", table_cell_style)]
    ]

    t_tech = Table(tech_data, colWidths=[120, 100, 284])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light])
    ]))
    story.append(t_tech)

    # Section 3: High-Level Architecture
    story.append(Spacer(1, 14))
    story.append(Paragraph("3. Architectural Layers & Data Flow", h1_style))
    story.append(Paragraph(
        "The system follows a layered, decoupled service architecture ensuring that gate physical operations cannot be compromised by application UI states:",
        body_style
    ))

    arch_box_data = [
        [Paragraph("<b>LAYER 1: CLIENT PRESENTATION (EXPO & REACT NATIVE WEB)</b><br/>"
                   "• <b>Resident App:</b> Home Dashboard, QuickActions Radial, Household Members, Visitor Pass Creation, Community Spaces, Help-Desk Tickets.<br/>"
                   "• <b>Workforce / Guard Portal:</b> Gate scanner, OTP verification, PermanentPass fast-track check-in, Visitor Departure log.<br/>"
                   "• <b>Management & Leadership:</b> Tenancy approvals, Personnel attendance, Community broadcast announcements, Role approvals.", table_cell_style)],
        [Paragraph("<b>LAYER 2: NETWORK & RECONCILIATION LAYER</b><br/>"
                   "• REST API endpoints over HTTPS with strict <code>Authorization: Bearer &lt;token&gt;</code> headers.<br/>"
                   "• Token refresh rotation & active session reconciliation every 60 seconds.<br/>"
                   "• Express Rate Limiters guarding authentication endpoints against credential stuffing and brute force.", table_cell_style)],
        [Paragraph("<b>LAYER 3: BUSINESS DOMAIN & CONTROLLERS (EXPRESS 5)</b><br/>"
                   "• <b>Auth Controller:</b> Strict registration flow (Public manager registration requires Leadership sign-off).<br/>"
                   "• <b>Household Controller:</b> 28-day validity lifecycle, cascade pause/revocation transactions.<br/>"
                   "• <b>Visitor Controller:</b> Concurrency locks on party sizes, gate arrival validation, 6-digit cryptographic OTP generation.", table_cell_style)],
        [Paragraph("<b>LAYER 4: PERSISTENCE & ACCESS CONTROL (PRISMA & POSTGRESQL 16)</b><br/>"
                   "• 34 Relational Tables with foreign key enforcement.<br/>"
                   "• Atomic transactions preventing race conditions during physical admission at community gates.", table_cell_style)]
    ]
    t_arch = Table(arch_box_data, colWidths=[504])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, brand_emerald),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_arch)

    # Page Break for Deep Dive
    story.append(PageBreak())

    # Section 4: Domain Hierarchy & Roles Deep Dive
    story.append(Paragraph("4. Comprehensive Domain Hierarchy & Stakeholder Model", h1_style))
    story.append(Paragraph(
        "A critical strength of Regency Salma is how it categorizes people, legal rights, and physical access. "
        "The hierarchy branches cleanly between <b>Legal Property Rights</b>, <b>Physical Residency Rights</b>, <b>Administrative Authority</b>, and <b>Operational Gate Access</b>.",
        body_style
    ))

    hierarchy_data = [
        [Paragraph("Entity / Role", table_header_style), Paragraph("Relationship / Scope", table_header_style), Paragraph("Privileges & Concrete Operational Capabilities", table_header_style)],
        
        [Paragraph("<b>LEADERSHIP</b><br/>(Council / RWA / Board)", table_cell_bold), Paragraph("Community-wide Authority", table_cell_style), 
         Paragraph("• Supreme administrative authority over the entire community.<br/>"
                   "• Reviews and approves/rejects new <b>Manager</b> and <b>Security Staff</b> appointments.<br/>"
                   "• Publishes community-wide Broadcast Announcements (URGENT / NORMAL).<br/>"
                   "• Strict database guard (<code>requireLeadership</code>); cannot be spoofed by manager or resident accounts.", table_cell_style)],

        [Paragraph("<b>PROPERTY OWNER / BUYER</b><br/>(UnitOwnership)", table_cell_bold), Paragraph("Unit-level Legal Ownership", table_cell_style), 
         Paragraph("• Holds registered deed / ownership record (<code>UnitOwnership ACTIVE</code>) for one or more physical units.<br/>"
                   "• Can reside in the flat (<code>Residency OWNER ACTIVE</code>) or be an absentee/non-resident landlord.<br/>"
                   "• Approves or rejects incoming <b>Tenants</b> attempting to register for their unit.<br/>"
                   "• Retains legal control over permanent access grants assigned to the property.", table_cell_style)],

        [Paragraph("<b>TENANT</b><br/>(UnitResidency: TENANT)", table_cell_bold), Paragraph("Unit-level Leased Residency", table_cell_style), 
         Paragraph("• Rents a unit from an Owner. Initial registration creates a <code>PENDING</code> residency.<br/>"
                   "• Once approved by the Owner or Community Manager, gains active residential rights.<br/>"
                   "• Can generate Guest/Delivery OTPs, register personal vehicles, and book community amenities.<br/>"
                   "• Does NOT have rights to approve other tenants or transfer unit ownership.", table_cell_style)],

        [Paragraph("<b>RESIDENT / FAMILY MEMBER</b><br/>(HouseholdMember)", table_cell_bold), Paragraph("Unit-level Occupant", table_cell_style), 
         Paragraph("• Family members, co-residents living within an active owner or tenant household.<br/>"
                   "• Can request visitor passes, view gate notifications, and engage in unit/community chat.<br/>"
                   "• Can have their access state set to <code>ACTIVE</code>, <code>PAUSED</code>, or <code>REVOKED</code>.", table_cell_style)],

        [Paragraph("<b>COMMUNITY MANAGER</b><br/>(Manager)", table_cell_bold), Paragraph("Operational Oversight", table_cell_style), 
         Paragraph("• Dispatches and oversees help-desk maintenance tickets (Plumbing, Electrical, Infrastructure).<br/>"
                   "• Assigns tasks to maintenance personnel and verifies completion.<br/>"
                   "• Manages staff rosters, duty schedules, and vendor registrations.", table_cell_style)],

        [Paragraph("<b>WORKFORCE & SECURITY</b><br/>(Watchman / Guard)", table_cell_bold), Paragraph("Perimeter & Gate Checkpoint", table_cell_style), 
         Paragraph("• Stationed at physical entrance gates.<br/>"
                   "• Validates 6-digit visitor OTPs and checks in pre-approved delivery/cab drivers.<br/>"
                   "• Scans <b>PermanentPass</b> QR codes for recurring household staff (maids, cooks, drivers).<br/>"
                   "• Immediate rejection if household member is PAUSED or REVOKED.", table_cell_style)],

        [Paragraph("<b>VISITORS & DELIVERY</b><br/>(Visitor)", table_cell_bold), Paragraph("Transient / Timed Access", table_cell_style), 
         Paragraph("• <b>Guests:</b> Receive a 6-digit OTP; locked after 5 failed attempts.<br/>"
                   "• <b>Deliveries / Cabs:</b> Pre-approved by resident; direct gate clearance without OTP.<br/>"
                   "• <b>Unannounced Visitors:</b> Guard enters details → push notification to resident → resident one-tap approve/reject.", table_cell_style)]
    ]

    t_hier = Table(hierarchy_data, colWidths=[120, 100, 284])
    t_hier.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light])
    ]))
    story.append(t_hier)

    # Section 5: Security Invariants & Business Logic Proofs
    story.append(Spacer(1, 14))
    story.append(Paragraph("5. Critical Security Invariants & Audit Proofs", h1_style))
    story.append(Paragraph(
        "Regency Salma incorporates strict mathematical invariants tested and verified at the database and endpoint layers:",
        body_style
    ))

    invariants = [
        ("1. Cascade Revocation & Pausing Invariant", 
         "When an Owner or Resident marks a HouseholdMember (e.g. domestic maid or driver) as PAUSED or REVOKED, an atomic Prisma transaction immediately updates all linked PermanentPass records to PAUSED/REVOKED. If that individual attempts gate check-in, the gate API returns an immediate 400 Bad Request error. Access cannot leak due to caching."),
        
        ("2. Renewal Guard Invariant", 
         "A PermanentPass can only be renewed for an additional 28-day window if its associated parent HouseholdMember is currently ACTIVE. Any attempt to renew a pass for a PAUSED or REVOKED member triggers a strict rejection."),
        
        ("3. Strict Leadership Isolation", 
         "Administrative community endpoints are protected by <code>requireLeadership</code>. Even a valid Community Manager or Owner receives a 403 Forbidden on leadership-only routes."),
        
        ("4. Public Registration Trapdoor", 
         "Users attempting to register publicly with the role of <code>MANAGER</code> are placed in a quarantined <code>PENDING</code> status. They have zero managerial privileges until an active Leadership member executes a formal approval."),
        
        ("5. Mandatory Purpose Enforcement", 
         "All visitor creation requests must supply a validated, non-empty <code>purpose</code> string (validated via Zod). Anonymous visitor passes are rejected at the schema level."),
        
        ("6. Cross-Community Invisibility (404 Invariant)", 
         "To prevent information leakage across multi-society deployments, queries across community boundaries do not return 403 Forbidden; they return 404 Not Found, keeping foreign resources completely invisible.")
    ]

    for title, desc in invariants:
        story.append(Paragraph(f"<b>{title}</b>", h2_style))
        story.append(Paragraph(desc, body_style))

    # Page Break for Lifecycle & Schema
    story.append(PageBreak())

    # Section 6: Visitor Lifecycle State Machine
    story.append(Paragraph("6. Visitor Lifecycle State Machine", h1_style))
    story.append(Paragraph(
        "The gate validation engine tracks visitors through an audited, deterministic state transition cycle:",
        body_style
    ))

    lifecycle_data = [
        [Paragraph("Lifecycle Stage", table_header_style), Paragraph("Trigger / Event", table_header_style), Paragraph("Security Checks & State Outcome", table_header_style)],
        [Paragraph("<b>CREATED</b>", table_cell_bold), Paragraph("Resident creates pass in app", table_cell_style), Paragraph("Zod validation checks purpose, unit residency, and generates 6-digit OTP.", table_cell_style)],
        [Paragraph("<b>PENDING</b>", table_cell_bold), Paragraph("Visitor arrives unannounced", table_cell_style), Paragraph("Guard inputs visitor phone; real-time alert sent to resident device for approval.", table_cell_style)],
        [Paragraph("<b>APPROVED</b>", table_cell_bold), Paragraph("Resident approves pass", table_cell_style), Paragraph("Gate status flips to APPROVED; ready for admission.", table_cell_style)],
        [Paragraph("<b>PARTIALLY_ADMITTED</b>", table_cell_bold), Paragraph("Party size admission (e.g. 2 of 5)", table_cell_style), Paragraph("Transactional check: <code>admittedCount &lt; partySize</code> to prevent over-admission.", table_cell_style)],
        [Paragraph("<b>CHECKED_IN</b>", table_cell_bold), Paragraph("Guard verifies OTP or Pass", table_cell_style), Paragraph("Timestamp recorded; visitor physically admitted to community premises.", table_cell_style)],
        [Paragraph("<b>CHECKED_OUT</b>", table_cell_bold), Paragraph("Visitor departs through gate", table_cell_style), Paragraph("Security logs exit time; pass transitions to completed state.", table_cell_style)],
        [Paragraph("<b>EXPIRED / REVOKED</b>", table_cell_bold), Paragraph("TTL expires or resident cancels", table_cell_style), Paragraph("Pass becomes invalid; subsequent gate check-in attempts return DENIED.", table_cell_style)]
    ]

    t_life = Table(lifecycle_data, colWidths=[110, 130, 264])
    t_life.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light])
    ]))
    story.append(t_life)

    # Section 7: Database Relational Structure (34 Tables)
    story.append(Spacer(1, 14))
    story.append(Paragraph("7. Relational Database Architecture (34 Core Tables)", h1_style))
    story.append(Paragraph(
        "The PostgreSQL schema managed by Prisma encompasses 34 specialized tables grouped into five logical subsystems:",
        body_style
    ))

    db_groups = [
        ("Identity & Membership Core", "<code>User</code>, <code>Membership</code>, <code>RefreshToken</code>, <code>AuditLog</code>"),
        ("Community & Property Topology", "<code>Community</code>, <code>Block</code>, <code>Unit</code>, <code>UnitOwnership</code>, <code>UnitResidency</code>"),
        ("Household & Access Management", "<code>HouseholdMember</code>, <code>PermanentPass</code>, <code>HouseholdVehicle</code>, <code>HouseholdPet</code>, <code>HouseholdHelp</code>"),
        ("Visitor & Gate Operations", "<code>Visitor</code>, <code>VisitorLog</code>, <code>GateCheckIn</code>, <code>GatePassAudit</code>"),
        ("Workforce, Operations & Help-Desk", "<code>Personnel</code>, <code>Department</code>, <code>Attendance</code>, <code>Ticket</code>, <code>Task</code>"),
        ("Social, Communication & Amenities", "<code>Channel</code>, <code>ChannelMember</code>, <code>Message</code>, <code>Space</code>, <code>SpaceMessage</code>, <code>Announcement</code>, <code>Poll</code>, <code>PollOption</code>, <code>PollVote</code>")
    ]

    db_table_data = [[Paragraph("Subsystem", table_header_style), Paragraph("Key Relational Tables Managed", table_header_style)]]
    for grp, tbls in db_groups:
        db_table_data.append([Paragraph(f"<b>{grp}</b>", table_cell_bold), Paragraph(tbls, table_cell_style)])

    t_db = Table(db_table_data, colWidths=[160, 344])
    t_db.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light])
    ]))
    story.append(t_db)

    # Section 8: Deployment & Operational Runbook
    story.append(Spacer(1, 14))
    story.append(Paragraph("8. Production & Local Deployment Runbook", h1_style))
    story.append(Paragraph(
        "<b>Reproducible Startup Commands:</b><br/>"
        "• <b>Database (Docker):</b> <code>docker run --name regency-salma-test-db -e POSTGRES_USER=regency_test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=regency_salma_test -p 5435:5432 -d postgres:16</code><br/>"
        "• <b>Backend Migrations:</b> <code>npx prisma migrate deploy</code> (Strict: never use <i>db push</i> in production).<br/>"
        "• <b>Seed Demo Accounts:</b> <code>npx ts-node src/seed.ts</code><br/>"
        "• <b>Launch Backend:</b> <code>npm run dev</code> (Runs Express on port 3005).<br/>"
        "• <b>Launch Frontend:</b> <code>npx expo start --web</code> (Runs Expo Metro on port 8081).",
        body_style
    ))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF generation complete: " + filename)

if __name__ == "__main__":
    build_pdf()
