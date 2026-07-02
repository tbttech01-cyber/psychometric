const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents, TabStopType, TabStopPosition, PositionalTab,
  PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader
} = require('docx');
const fs = require('fs');

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  primary:    '1B3A6B',
  accent:     '2563EB',
  accentLight:'DBEAFE',
  gold:       'B45309',
  goldLight:  'FEF3C7',
  green:      '166534',
  greenLight: 'DCFCE7',
  red:        '991B1B',
  redLight:   'FEE2E2',
  purple:     '6D28D9',
  purpleLight:'EDE9FE',
  gray1:      'F8FAFC',
  gray2:      'E2E8F0',
  gray3:      '94A3B8',
  gray4:      '475569',
  gray5:      '1E293B',
  white:      'FFFFFF',
  black:      '000000',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const border = (color=C.gray2) => ({ style: BorderStyle.SINGLE, size: 4, color });
const borders = (color=C.gray2) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' });
const noBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });
const cellM = { top: 100, bottom: 100, left: 120, right: 120 };
const cellMW = { top: 120, bottom: 120, left: 160, right: 160 };

function p(children, opts={}) {
  return new Paragraph({ children, ...opts });
}
function txt(text, opts={}) {
  return new TextRun({ text, font:'Arial', ...opts });
}
function br() { return new Paragraph({ children: [], spacing: { before: 0, after: 80 } }); }
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// Heading helpers
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font:'Arial', size: 36, bold: true, color: C.primary })],
    spacing: { before: 360, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 6 } }
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font:'Arial', size: 28, bold: true, color: C.accent })],
    spacing: { before: 280, after: 140 }
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font:'Arial', size: 24, bold: true, color: C.primary })],
    spacing: { before: 200, after: 100 }
  });
}
function h4(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_4,
    children: [new TextRun({ text, font:'Arial', size: 22, bold: true, color: C.gray5 })],
    spacing: { before: 160, after: 80 }
  });
}
function body(text, opts={}) {
  return new Paragraph({
    children: [new TextRun({ text, font:'Arial', size: 22, color: C.gray5, ...opts })],
    spacing: { before: 60, after: 60 }
  });
}
function bodyBold(text) {
  return new Paragraph({
    children: [new TextRun({ text, font:'Arial', size: 22, bold: true, color: C.gray5 })],
    spacing: { before: 60, after: 60 }
  });
}
function note(text, color=C.accentLight, textColor=C.primary) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorders(),
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: cellMW,
        children: [new Paragraph({ children: [new TextRun({ text: '💡 ' + text, font:'Arial', size: 20, color: textColor })] })]
      })
    ]})]
  });
}
function warn(text) { return note('⚠️  ' + text.replace('⚠️  ',''), C.goldLight, C.gold); }
function critical(text) { return note('🔴 CRITICAL: ' + text, C.redLight, C.red); }

// Bullet list
function bullets(items, indent=360) {
  return items.map(item => new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text: item, font:'Arial', size: 22, color: C.gray5 })],
    spacing: { before: 40, after: 40 }
  }));
}
function subBullets(items) {
  return items.map(item => new Paragraph({
    numbering: { reference: 'subbullets', level: 0 },
    children: [new TextRun({ text: item, font:'Arial', size: 20, color: C.gray4 })],
    spacing: { before: 30, after: 30 }
  }));
}
function numbered(items) {
  return items.map(item => new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    children: [new TextRun({ text: item, font:'Arial', size: 22, color: C.gray5 })],
    spacing: { before: 40, after: 40 }
  }));
}

// Simple 2-col table
function kv(pairs, w1=3000, w2=6360) {
  const totalW = w1 + w2;
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: [w1, w2],
    rows: pairs.map(([k, v], i) => new TableRow({
      children: [
        new TableCell({
          borders: borders(C.gray2),
          shading: { fill: i%2===0 ? C.gray1 : C.white, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: w1, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: k, font:'Arial', size: 20, bold: true, color: C.primary })] })]
        }),
        new TableCell({
          borders: borders(C.gray2),
          shading: { fill: i%2===0 ? C.gray1 : C.white, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: w2, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: v, font:'Arial', size: 20, color: C.gray5 })] })]
        })
      ]
    }))
  });
}

// Full-width section label
function sectionLabel(text, color=C.primary, bg=C.accentLight) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorders(),
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 200, right: 200 },
        children: [new Paragraph({ children: [new TextRun({ text, font:'Arial', size: 22, bold: true, color })] })]
      })
    ]})]
  });
}

// API table
function apiTable(rows) {
  const cols = [1200, 2400, 3000, 1200, 1560];
  const total = cols.reduce((a,b)=>a+b,0);
  const headers = ['Method', 'Endpoint', 'Description', 'Auth', 'Response'];
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h,i) => new TableCell({
          borders: borders(C.accent),
          shading: { fill: C.primary, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: h, font:'Arial', size: 18, bold: true, color: C.white })] })]
        }))
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => new TableCell({
          borders: borders(C.gray2),
          shading: { fill: ri%2===0 ? C.gray1 : C.white, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[ci], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cell, font:'Arial', size: 18, color: ci===0 ? C.accent : C.gray5, bold: ci===0 })] })]
        }))
      }))
    ]
  });
}

// Field spec table
function fieldTable(rows) {
  const cols = [1800, 1400, 1200, 2400, 2560];
  const total = cols.reduce((a,b)=>a+b,0);
  const headers = ['Field / Element', 'Type', 'Required', 'Validation Rules', 'Notes'];
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h,i) => new TableCell({
          borders: borders(C.accent),
          shading: { fill: C.accent, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: h, font:'Arial', size: 18, bold: true, color: C.white })] })]
        }))
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => new TableCell({
          borders: borders(C.gray2),
          shading: { fill: ri%2===0 ? C.gray1 : C.white, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[ci], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cell, font:'Arial', size: 18, color: C.gray5 })] })]
        }))
      }))
    ]
  });
}

// DB schema table
function dbTable(fields) {
  const cols = [1800, 1400, 1000, 1200, 3960];
  const total = cols.reduce((a,b)=>a+b,0);
  const headers = ['Field', 'Type', 'Required', 'Indexed', 'Description'];
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h,i) => new TableCell({
          borders: borders(C.purple),
          shading: { fill: C.purple, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: h, font:'Arial', size: 18, bold: true, color: C.white })] })]
        }))
      }),
      ...fields.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => new TableCell({
          borders: borders(C.gray2),
          shading: { fill: ri%2===0 ? C.purpleLight : C.white, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[ci], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cell, font:'Arial', size: 18, color: ci===0 ? C.purple : C.gray5, bold: ci===0 })] })]
        }))
      }))
    ]
  });
}

// Button spec row
function btnTable(rows) {
  const cols = [2000, 1600, 1600, 4160];
  const total = cols.reduce((a,b)=>a+b,0);
  const headers = ['Button Label', 'Trigger', 'State', 'Action / Wire'];
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h,i) => new TableCell({
          borders: borders(C.green),
          shading: { fill: C.green, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: h, font:'Arial', size: 18, bold: true, color: C.white })] })]
        }))
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => new TableCell({
          borders: borders(C.gray2),
          shading: { fill: ri%2===0 ? C.greenLight : C.white, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: cols[ci], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cell, font:'Arial', size: 18, color: ci===0 ? C.green : C.gray5, bold: ci===0 })] })]
        }))
      }))
    ]
  });
}

// Generic multi-col table
function genTable(headers, rows, colWidths, headerColor=C.primary) {
  const total = colWidths.reduce((a,b)=>a+b,0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h,i) => new TableCell({
          borders: borders(headerColor),
          shading: { fill: headerColor, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: colWidths[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: h, font:'Arial', size: 18, bold: true, color: C.white })] })]
        }))
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => new TableCell({
          borders: borders(C.gray2),
          shading: { fill: ri%2===0 ? C.gray1 : C.white, type: ShadingType.CLEAR },
          margins: cellM,
          width: { size: colWidths[ci], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cell, font:'Arial', size: 18, color: C.gray5 })] })]
        }))
      }))
    ]
  });
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────────
function coverPage() {
  return [
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [new TableRow({ children: [new TableCell({
        borders: noBorders(),
        shading: { fill: C.primary, type: ShadingType.CLEAR },
        margins: { top: 800, bottom: 800, left: 600, right: 600 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing:{before:200,after:100}, children: [new TextRun({ text: '🧠', font:'Arial', size: 80 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing:{before:0,after:60}, children: [new TextRun({ text: 'PSYCHOMETRIC ASSESSMENT PLATFORM', font:'Arial', size: 52, bold: true, color: C.white })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing:{before:0,after:200}, children: [new TextRun({ text: 'Enterprise-Grade Full Specification Kit  |  Version 2.0', font:'Arial', size: 26, color: 'BFDBFE' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', font:'Arial', size: 22, color: '3B82F6' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing:{before:120,after:40}, children: [new TextRun({ text: 'ADMIN APPLICATION  +  USER WEB APPLICATION', font:'Arial', size: 28, bold: true, color: 'FCD34D' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing:{before:40,after:200}, children: [new TextRun({ text: 'Complete Database · API · UI · Business Logic · Wiring Specification', font:'Arial', size: 22, color: 'BFDBFE' })] }),
        ]
      })]})]
    }),
    br(),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4600, 4760],
      rows: [new TableRow({ children: [
        new TableCell({
          borders: borders(C.gray2),
          shading: { fill: C.gray1, type: ShadingType.CLEAR },
          margins: cellMW,
          width: { size: 4600, type: WidthType.DXA },
          children: [
            p([txt('DOCUMENT TYPE', {bold:true,color:C.accent,size:18})]),
            p([txt('AI-Ready Full Technical Specification', {color:C.gray5,size:20})]),
            br(),
            p([txt('AUDIENCE', {bold:true,color:C.accent,size:18})]),
            p([txt('AI Coding Tools · Senior Developers · Architects', {color:C.gray5,size:20})]),
            br(),
            p([txt('VERSION', {bold:true,color:C.accent,size:18})]),
            p([txt('2.0 — Professional Edition', {color:C.gray5,size:20})]),
          ]
        }),
        new TableCell({
          borders: borders(C.gray2),
          shading: { fill: C.accentLight, type: ShadingType.CLEAR },
          margins: cellMW,
          width: { size: 4760, type: WidthType.DXA },
          children: [
            p([txt('WHAT THIS DOCUMENT COVERS', {bold:true,color:C.primary,size:18})]),
            p([txt('✅  Complete MongoDB Schema (9 collections)', {color:C.gray5,size:20})]),
            p([txt('✅  All API Endpoints with payload specs', {color:C.gray5,size:20})]),
            p([txt('✅  Every UI page — field-by-field breakdown', {color:C.gray5,size:20})]),
            p([txt('✅  All button actions and wiring', {color:C.gray5,size:20})]),
            p([txt('✅  Full business logic and scoring engine', {color:C.gray5,size:20})]),
            p([txt('✅  Auth flows, session rules, OTP flows', {color:C.gray5,size:20})]),
            p([txt('✅  Non-functional & security requirements', {color:C.gray5,size:20})]),
            p([txt('✅  AI prompt guide in build sequence', {color:C.gray5,size:20})]),
          ]
        })
      ]})]
    }),
    pageBreak()
  ];
}

// ─── TOC ──────────────────────────────────────────────────────────────────────
function tocSection() {
  return [
    h1('Table of Contents'),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-4',
    }),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: PRODUCT OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function part1() {
  return [
    h1('PART 1 — PRODUCT OVERVIEW & ARCHITECTURE'),
    h2('1.1  Product Vision'),
    body('The Psychometric Assessment Platform is a professional-grade, full-stack SaaS web application that evaluates aspiring entrepreneurs across 8 evidence-based psychometric dimensions derived from personality psychology (Big Five, Holland Codes, and entrepreneurial trait models). Upon completion, the system generates a personalised business type recommendation with detailed explanations and improvement guidance.'),
    br(),
    body('The platform operates as two distinct, independently deployable applications sharing a single backend API and MongoDB database:'),
    ...bullets([
      'User Web Application — Public-facing portal where end-users discover their entrepreneurial personality and receive business recommendations.',
      'Admin Application — Restricted management console for platform administrators to manage access codes, questions, users, and analytics.',
    ]),
    br(),
    h2('1.2  Technology Stack'),
    kv([
      ['Runtime', 'Node.js v18+ (LTS)'],
      ['Framework', 'Express.js v4+'],
      ['Database', 'MongoDB (Atlas or local) with Mongoose ODM v7+'],
      ['Auth', 'bcryptjs (password hashing, saltRounds=10) · jsonwebtoken (JWT) · express-validator'],
      ['Email / OTP', 'Nodemailer with Gmail SMTP App Password'],
      ['File Export', 'pdfkit (PDF generation) · json2csv (CSV export)'],
      ['Frontend', 'HTML5 · Tailwind CSS v3 (CDN) · Vanilla JavaScript ES6+'],
      ['Charts', 'Chart.js v4 (CDN) — Bar chart + Doughnut chart on admin dashboard'],
      ['Security', 'helmet · cors · express-rate-limit · dotenv'],
      ['Dev Tools', 'nodemon · morgan (logging) · dotenv'],
    ], 2000, 7360),
    br(),
    h2('1.3  System Architecture Diagram'),
    note('BROWSER (User App) ──► API Server (Express.js) ──► MongoDB Atlas\nBROWSER (Admin App) ──► API Server (Express.js) ──► MongoDB Atlas\nAPI Server ──► Gmail SMTP (OTP delivery)\nAPI Server ──► pdfkit / json2csv (exports)'),
    br(),
    h2('1.4  Roles & Permissions Matrix'),
    genTable(
      ['Capability','Admin','User'],
      [
        ['Register / Login','✅ Email+Password+OTP','✅ SharedUserID+Register+OTP+Login'],
        ['Take Assessment','❌ Not applicable','✅ Yes'],
        ['View Own Result','❌ Not applicable','✅ Yes (no export)'],
        ['Manage Shared User IDs','✅ CRUD','❌'],
        ['Manage Question Types','✅ CRUD','❌'],
        ['Manage Questions','✅ CRUD','❌'],
        ['Manage Answer Options','✅ CRUD (with marks)','❌'],
        ['View All Results','✅ Paginated + filtered','❌'],
        ['Export PDF','✅ Yes','❌'],
        ['Export CSV','✅ Yes','❌'],
        ['Dashboard Analytics','✅ Full charts + KPIs','❌'],
        ['Session Management','Single session (8h JWT)','Single session (2h JWT)'],
      ],
      [3000, 2400, 3960],
      C.primary
    ),
    br(),
    h2('1.5  Project Folder Structure'),
    note(
`psychometric-assessment-app/
├── backend/
│   ├── server.js              # Express entry point, middleware, route mounting
│   ├── .env                   # ALL secrets (never commit)
│   ├── .gitignore             # Must include .env, node_modules
│   ├── config/
│   │   └── db.js              # Mongoose connection with retry logic
│   ├── models/
│   │   ├── Admin.js
│   │   ├── SharedUserID.js
│   │   ├── User.js
│   │   ├── QuestionType.js
│   │   ├── Question.js
│   │   ├── AnswerOption.js
│   │   ├── AssessmentSession.js
│   │   ├── UserAnswer.js
│   │   └── Result.js
│   ├── routes/
│   │   ├── adminAuth.js       # POST /api/admin/login, /verify-otp, /logout
│   │   ├── adminCRUD.js       # SharedUserID, QuestionType, Question, AnswerOption CRUD
│   │   ├── adminDashboard.js  # GET /api/admin/dashboard, /results, /export
│   │   ├── userAuth.js        # POST /api/user/validate-code, /register, /verify-otp, /login, /logout
│   │   └── assessment.js      # GET questions, POST start/submit, GET result
│   ├── controllers/           # Business logic separated from routes
│   │   ├── adminAuthController.js
│   │   ├── adminCRUDController.js
│   │   ├── adminDashboardController.js
│   │   ├── userAuthController.js
│   │   └── assessmentController.js
│   ├── middleware/
│   │   ├── adminAuth.js       # Verify admin JWT + check token not revoked
│   │   ├── userAuth.js        # Verify user JWT + single-session check
│   │   └── errorHandler.js    # Global error handler
│   └── utils/
│       ├── otpGenerator.js    # 6-digit numeric OTP + expiry timestamp
│       ├── emailSender.js     # Nodemailer wrapper (OTP + welcome emails)
│       ├── scoreCalculator.js # Category scores, percentage, level, recommendation
│       └── exportHelper.js    # PDF (pdfkit) + CSV (json2csv) generation
└── frontend/
    ├── user/
    │   ├── index.html         # Home: Enter Shared User ID
    │   ├── register.html      # Registration form
    │   ├── otp-register.html  # OTP verification after register
    │   ├── login.html         # Returning user login
    │   ├── otp-login.html     # OTP not needed for login (see note)
    │   ├── welcome.html       # Pre-assessment instructions
    │   ├── assessment.html    # Assessment engine (40 Qs, timer, sidebar)
    │   └── result.html        # Personalised result page
    ├── admin/
    │   ├── login.html         # Admin email + password
    │   ├── otp.html           # Admin OTP verification
    │   ├── dashboard.html     # KPI cards + charts + recent results
    │   ├── shared-ids.html    # Manage Shared User IDs
    │   ├── question-types.html # Manage 8 psychometric categories
    │   ├── questions.html     # Manage individual questions
    │   ├── answer-options.html # Manage answer options + marks
    │   └── results.html       # View, search, filter, export results
    └── assets/
        ├── css/
        │   └── custom.css     # Supplemental styles (animations, custom components)
        └── js/
            ├── api.js         # Fetch wrapper with JWT auth headers
            ├── timer.js       # Assessment countdown with auto-submit
            ├── charts.js      # Chart.js initialisation helpers
            └── validator.js   # Client-side form validation helpers`
    ),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: DATABASE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════
function part2() {
  return [
    h1('PART 2 — DATABASE SCHEMA (MongoDB Collections)'),
    note('All collections use MongoDB ObjectId as _id. All timestamps use ISO 8601 UTC. Mongoose models must enable timestamps: { createdAt: true, updatedAt: true } unless stated otherwise.'),
    br(),

    h2('2.1  Admins Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['email','String','Yes','Yes (unique)','Admin email address. Lowercase, trimmed. Must be unique.'],
      ['passwordHash','String','Yes','No','bcrypt hash (saltRounds=10). Never return in API responses.'],
      ['otpCode','String','No','No','6-digit numeric OTP string. Cleared after successful verification.'],
      ['otpExpiry','Date','No','No','OTP expiration timestamp. OTP invalid if Date.now() > otpExpiry.'],
      ['activeToken','String','No','No','Current valid JWT token string. Used to revoke sessions on logout.'],
      ['lastLoginAt','Date','No','No','Timestamp of most recent successful login. Updated on each login.'],
      ['createdAt','Date','Auto','No','Mongoose timestamps auto-field.'],
      ['updatedAt','Date','Auto','No','Mongoose timestamps auto-field.'],
    ]),
    br(),
    critical('There should be exactly ONE admin document in production. Seed it via a one-time script with a strong hashed password. Do NOT expose a public admin registration endpoint.'),
    br(),

    h2('2.2  SharedUserIDs Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['code','String','Yes','Yes (unique)','The access code users enter. Uppercase alphanumeric, e.g. "BATCH2024A". Min 4, max 20 chars.'],
      ['label','String','Yes','No','Human-readable name for the admin, e.g. "Batch 2024 — Section A". Max 100 chars.'],
      ['isActive','Boolean','Yes','Yes','If false, users cannot use this code to register. Default: true.'],
      ['createdBy','ObjectId','Yes','No','Reference to Admins._id who created this code.'],
      ['usageCount','Number','Auto','No','Auto-incremented each time a new user registers with this code. Default: 0.'],
      ['createdAt','Date','Auto','No','Auto from timestamps.'],
      ['updatedAt','Date','Auto','No','Auto from timestamps.'],
    ]),
    br(),

    h2('2.3  Users Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['name','String','Yes','No','Full name. Trimmed. 2–100 characters.'],
      ['email','String','Yes','Yes (unique)','Lowercase email. Must be unique across all users. Validated with regex.'],
      ['passwordHash','String','Yes','No','bcrypt hash (saltRounds=10). Never returned in API responses.'],
      ['sharedUserID','ObjectId','Yes','Yes','Reference to SharedUserIDs._id. Set during registration.'],
      ['sharedCode','String','Yes','No','Denormalised: the code string itself. Stored for quick display on result page.'],
      ['isVerified','Boolean','Yes','No','True after OTP email verification. Unverified users cannot log in. Default: false.'],
      ['otpCode','String','No','No','6-digit numeric OTP. Set during registration or re-send. Cleared after verification.'],
      ['otpExpiry','Date','No','No','OTP expiration timestamp (5 minutes after generation).'],
      ['activeToken','String','No','No','Current valid JWT. Overwritten on every new login (single-session enforcement).'],
      ['hasCompletedAssessment','Boolean','Yes','No','True after first successful submission. Default: false.'],
      ['createdAt','Date','Auto','No','Auto from timestamps.'],
      ['updatedAt','Date','Auto','No','Auto from timestamps.'],
    ]),
    br(),

    h2('2.4  QuestionTypes Collection (8 Psychometric Categories)'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['name','String','Yes','Yes (unique)','Category name. One of the 8 defined types. Max 60 chars.'],
      ['description','String','Yes','No','Brief description shown to admin only. Max 300 chars.'],
      ['icon','String','No','No','Emoji or icon code for display. E.g. "💬" for Communication.'],
      ['color','String','No','No','Hex color for charts/sidebar. E.g. "#2563EB".'],
      ['order','Number','Yes','Yes','Display order (1–8). Must be unique.'],
      ['isActive','Boolean','Yes','No','If false, category and its questions are excluded from assessments. Default: true.'],
      ['createdAt','Date','Auto','No','Auto from timestamps.'],
      ['updatedAt','Date','Auto','No','Auto from timestamps.'],
    ]),
    br(),
    note('Seed the 8 categories in this exact order: 1) Communication, 2) Creativity, 3) Problem Solving, 4) Leadership, 5) Risk Taking, 6) Financial Awareness, 7) Business Mindset, 8) Teamwork'),
    br(),

    h2('2.5  Questions Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['typeId','ObjectId','Yes','Yes','Reference to QuestionTypes._id. Used to group questions by category.'],
      ['text','String','Yes','No','The question text displayed to users. Max 500 characters.'],
      ['order','Number','Yes','Yes','Global question order (1–40). Must be unique across all questions.'],
      ['isActive','Boolean','Yes','No','If false, excluded from live assessments. Default: true.'],
      ['createdAt','Date','Auto','No','Auto from timestamps.'],
      ['updatedAt','Date','Auto','No','Auto from timestamps.'],
    ]),
    br(),
    critical('There must always be exactly 5 active questions per QuestionType. Total = 40. Enforce this via admin UI validation before saving.'),
    br(),

    h2('2.6  AnswerOptions Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['questionId','ObjectId','Yes','Yes','Reference to Questions._id.'],
      ['label','String','Yes','No','Text shown to user, e.g. "Strongly Agree". Never exposes marks.'],
      ['marks','Number','Yes','No','Integer 1–5. Likert scale score. NEVER sent to user-facing API responses.'],
      ['order','Number','Yes','No','Display order per question (1–5). Strongly Agree=5 marks, Strongly Disagree=1 mark.'],
      ['createdAt','Date','Auto','No','Auto from timestamps.'],
    ]),
    br(),
    note('Standard 5 options per question: Strongly Agree (5), Agree (4), Neutral (3), Disagree (2), Strongly Disagree (1). Admin can customise labels but marks 1–5 are fixed by position.'),
    br(),

    h2('2.7  AssessmentSessions Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['userId','ObjectId','Yes','Yes','Reference to Users._id.'],
      ['startedAt','Date','Yes','No','Server timestamp when POST /assessment/start is called.'],
      ['submittedAt','Date','No','No','Server timestamp when submission is accepted. Null until submitted.'],
      ['expiresAt','Date','Yes','No','startedAt + 30 minutes. Used for server-side expiry validation.'],
      ['status','String','Yes','Yes','Enum: "in-progress" | "submitted" | "expired". Default: "in-progress".'],
      ['autoSubmitted','Boolean','Yes','No','True if timer triggered auto-submit (client sent flag in payload). Default: false.'],
      ['totalAnswered','Number','Yes','No','Running count of answered questions. Updated on each partial save (if implemented).'],
      ['ipAddress','String','No','No','Optional: client IP for audit trail.'],
      ['createdAt','Date','Auto','No','Auto from timestamps.'],
    ]),
    br(),

    h2('2.8  UserAnswers Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['sessionId','ObjectId','Yes','Yes','Reference to AssessmentSessions._id.'],
      ['userId','ObjectId','Yes','Yes','Denormalised for fast querying. Reference to Users._id.'],
      ['questionId','ObjectId','Yes','No','Reference to Questions._id.'],
      ['answerOptionId','ObjectId','Yes','No','Reference to AnswerOptions._id (chosen option).'],
      ['marks','Number','Yes','No','Denormalised marks value (1–5) copied from AnswerOption at submission time.'],
      ['questionOrder','Number','Yes','No','Denormalised question order for result display.'],
      ['answeredAt','Date','Yes','No','Timestamp when this answer was recorded.'],
    ]),
    br(),

    h2('2.9  Results Collection'),
    dbTable([
      ['_id','ObjectId','Auto','Yes (PK)','MongoDB auto-generated primary key'],
      ['userId','ObjectId','Yes','Yes','Reference to Users._id.'],
      ['sessionId','ObjectId','Yes','Yes (unique)','Reference to AssessmentSessions._id. One result per session.'],
      ['totalMarks','Number','Yes','No','Sum of all 40 answer marks. Range: 40–200.'],
      ['percentage','Number','Yes','No','(totalMarks / 200) * 100. Stored as float, 1 decimal place.'],
      ['level','String','Yes','No','Enum: "Excellent" | "Good" | "Average" | "Needs Improvement".'],
      ['categoryScores','Object','Yes','No','Map of {categoryName: score}. E.g. { "Communication": 18, "Creativity": 22 }.'],
      ['categoryPercentages','Object','Yes','No','Map of {categoryName: percentage}. Each category max = 25 (5 Qs × 5 marks).'],
      ['highestCategory','Array','Yes','No','Array of category name strings (handles ties). E.g. ["Creativity", "Leadership"].'],
      ['recommendedBusiness','Array','Yes','No','Array of business type strings mapped from highestCategory.'],
      ['explanation','String','Yes','No','AI-generated or template explanation paragraph. Max 1000 chars.'],
      ['improvementAreas','Array','Yes','No','Array of {category, suggestion} objects for lowest 2 scoring categories.'],
      ['createdAt','Date','Auto','Yes','Auto from timestamps. Used for date-range filters.'],
    ]),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: BACKEND API
// ═══════════════════════════════════════════════════════════════════════════════
function part3() {
  return [
    h1('PART 3 — BACKEND API SPECIFICATION'),
    note('Base URL: /api. All JSON requests must include Content-Type: application/json. All protected endpoints require Authorization: Bearer <token> header. All responses include { success: true/false, data: {}, message: "", errors: [] }'),
    br(),

    h2('3.1  Admin Authentication APIs'),
    h3('POST /api/admin/login'),
    body('Validates admin email and password. On success, generates 6-digit OTP, saves to Admin.otpCode + otpExpiry, sends OTP email. Does NOT issue JWT at this stage.'),
    br(),
    fieldTable([
      ['email','String (body)','Yes','Valid email format · Must exist in Admins collection','Lowercase before DB lookup'],
      ['password','String (body)','Yes','Min 8 chars · Non-empty','Compare with bcrypt.compare()'],
    ]),
    br(),
    genTable(['Scenario','HTTP Status','Response Body'],[
      ['Valid credentials','200 OK','{ success: true, message: "OTP sent to your email" }'],
      ['Wrong password','401','{ success: false, message: "Invalid credentials" }'],
      ['Email not found','401','{ success: false, message: "Invalid credentials" } (same message for security)'],
      ['Validation error','400','{ success: false, errors: [{field, message}] }'],
      ['Server error','500','{ success: false, message: "Server error" }'],
    ],[3200,1400,4760],C.red),
    br(),

    h3('POST /api/admin/verify-otp'),
    body('Verifies the 6-digit OTP for admin login. On success, clears OTP fields, sets activeToken, returns JWT.'),
    fieldTable([
      ['email','String (body)','Yes','Valid email format','Used to look up admin record'],
      ['otp','String (body)','Yes','Exactly 6 numeric digits','Compared against Admin.otpCode. Check expiry first.'],
    ]),
    br(),
    genTable(['Scenario','HTTP Status','Response Body'],[
      ['Valid OTP','200 OK','{ success: true, token: "<JWT>", admin: { _id, email } }'],
      ['Expired OTP','400','{ success: false, message: "OTP has expired. Please login again." }'],
      ['Wrong OTP','400','{ success: false, message: "Invalid OTP." }'],
      ['Already used','400','{ success: false, message: "OTP already used." }'],
    ],[3200,1400,4760],C.red),
    br(),

    h3('POST /api/admin/logout'),
    body('Clears Admin.activeToken in DB. JWT is short-lived but this ensures immediate invalidation.'),
    genTable(['Field','Location','Notes'],[
      ['Authorization','Header','Bearer <adminToken>. Middleware verifies this first.'],
    ],[3000,2000,4360],C.primary),
    br(),

    h2('3.2  Admin CRUD APIs — Shared User IDs'),
    apiTable([
      ['GET','/api/admin/shared-ids','List all Shared User IDs, sorted by createdAt desc. Supports ?search= for code/label filter.','Admin JWT','{ data: [SharedUserID], total }'],
      ['POST','/api/admin/shared-ids','Create new Shared User ID. Validate uniqueness of code.','Admin JWT','{ data: SharedUserID }'],
      ['PUT','/api/admin/shared-ids/:id','Update label or isActive for a specific code.','Admin JWT','{ data: updatedSharedUserID }'],
      ['DELETE','/api/admin/shared-ids/:id','Soft delete: set isActive=false. Does NOT remove DB record. Users registered with this code retain their accounts.','Admin JWT','{ success: true }'],
      ['GET','/api/admin/shared-ids/:id/stats','Get usage stats: usageCount, list of users who registered.','Admin JWT','{ usageCount, users: [] }'],
    ]),
    br(),
    fieldTable([
      ['code','String (body)','Yes — POST','Uppercase alphanumeric only [A-Z0-9]. 4–20 chars. Must be unique.','Auto-uppercase on server'],
      ['label','String (body)','Yes — POST/PUT','Human-readable name. 3–100 chars.','E.g. "March 2025 Cohort"'],
      ['isActive','Boolean (body)','Optional — PUT','true or false','Used to enable/disable access code'],
    ]),
    br(),

    h2('3.3  Admin CRUD APIs — Question Types'),
    apiTable([
      ['GET','/api/admin/question-types','List all 8 question types ordered by order field.','Admin JWT','{ data: [QuestionType] }'],
      ['POST','/api/admin/question-types','Create new question type (max 8 active).','Admin JWT','{ data: QuestionType }'],
      ['PUT','/api/admin/question-types/:id','Update name, description, icon, color, order, isActive.','Admin JWT','{ data: updatedQuestionType }'],
      ['DELETE','/api/admin/question-types/:id','Soft delete only if no active questions are linked.','Admin JWT','{ success: true }'],
    ]),
    fieldTable([
      ['name','String (body)','Yes','2–60 chars. Must be unique across active types.','E.g. "Communication"'],
      ['description','String (body)','Yes','10–300 chars.','Shown only in admin panel'],
      ['icon','String (body)','No','Emoji character or empty string.','E.g. "💬"'],
      ['color','String (body)','No','Hex color string. E.g. "#2563EB"','Used in charts and sidebar'],
      ['order','Number (body)','Yes','Integer 1–8. Must be unique.','Controls question display order'],
    ]),
    br(),

    h2('3.4  Admin CRUD APIs — Questions'),
    apiTable([
      ['GET','/api/admin/questions','List all questions. Supports ?typeId= filter. Includes populated QuestionType name.','Admin JWT','{ data: [Question+typeId] }'],
      ['GET','/api/admin/questions/:id','Get single question with all its AnswerOptions populated.','Admin JWT','{ data: Question+options }'],
      ['POST','/api/admin/questions','Create a new question. Validate: typeId must be active, active count per type must be <5.','Admin JWT','{ data: Question }'],
      ['PUT','/api/admin/questions/:id','Update text, order, isActive.','Admin JWT','{ data: updatedQuestion }'],
      ['DELETE','/api/admin/questions/:id','Soft delete (isActive=false). Cascade: also soft-deactivate all AnswerOptions for this question.','Admin JWT','{ success: true }'],
    ]),
    fieldTable([
      ['typeId','ObjectId (body)','Yes','Must reference an existing, active QuestionType.','Validated by middleware'],
      ['text','String (body)','Yes','10–500 chars. Non-empty after trim.','The question shown to users'],
      ['order','Number (body)','Yes','Global integer 1–40. Must be unique across active questions.','Controls assessment sequence'],
    ]),
    br(),

    h2('3.5  Admin CRUD APIs — Answer Options'),
    apiTable([
      ['GET','/api/admin/answer-options?questionId=','List all 5 options for a question ordered by order field.','Admin JWT','{ data: [AnswerOption] }'],
      ['POST','/api/admin/answer-options','Create a new option. Max 5 per question. Marks must be 1–5 and unique per question.','Admin JWT','{ data: AnswerOption }'],
      ['PUT','/api/admin/answer-options/:id','Update label or marks (reorder marks if changed).','Admin JWT','{ data: updatedAnswerOption }'],
      ['DELETE','/api/admin/answer-options/:id','Hard delete. Only allowed if question is not yet used in any AssessmentSession.','Admin JWT','{ success: true }'],
    ]),
    fieldTable([
      ['questionId','ObjectId (body)','Yes','Must reference existing active Question.',''],
      ['label','String (body)','Yes','2–100 chars. E.g. "Strongly Agree"','Shown to users during assessment'],
      ['marks','Number (body)','Yes','Integer 1–5. Must be unique within same question.','NEVER returned in user-facing API'],
      ['order','Number (body)','Yes','Integer 1–5. Controls display order.','1=top, 5=bottom typically'],
    ]),
    br(),

    h2('3.6  Admin Dashboard & Analytics APIs'),
    apiTable([
      ['GET','/api/admin/dashboard','Aggregated KPI cards + chart data for last 30 days.','Admin JWT','{ cards: {}, barChart: {}, pieChart: {} }'],
      ['GET','/api/admin/results','Paginated, searchable, filterable list of all completed assessments.','Admin JWT','{ data: [], total, page, pages }'],
      ['GET','/api/admin/export/pdf','Stream PDF of all results (or filtered set) using pdfkit.','Admin JWT','application/pdf stream'],
      ['GET','/api/admin/export/csv','Stream CSV of all results (or filtered set) using json2csv.','Admin JWT','text/csv attachment'],
    ]),
    br(),
    body('Dashboard Response Structure:'),
    note(
`{
  "cards": {
    "totalUsersRegistered": 240,
    "totalAssessmentsCompleted": 198,
    "totalAssessmentsInProgress": 12,
    "averageScore": 127.4,
    "highestScore": 186,
    "lowestScore": 62,
    "activeSharedCodes": 5
  },
  "barChart": {
    "labels": ["2025-01-01", "2025-01-02", ...],   // last 30 days
    "data": [4, 7, 2, ...]                           // count of completed assessments per day
  },
  "pieChart": {
    "labels": ["Consulting", "E-commerce", "IT Services", ...],
    "data": [42, 38, 29, ...]                        // count of each recommended business type
  },
  "recentResults": [ ...last 10 results with user details... ]
}`
    ),
    br(),
    body('Results API Query Parameters:'),
    fieldTable([
      ['page','Query param','No','Integer ≥ 1. Default: 1.','Pagination page number'],
      ['limit','Query param','No','Integer 10/25/50. Default: 25.','Results per page'],
      ['search','Query param','No','String. Matched against user name, email, sharedCode.','Case-insensitive regex search'],
      ['dateFrom','Query param','No','ISO date string. Filter results from this date.','Inclusive'],
      ['dateTo','Query param','No','ISO date string. Filter results to this date.','Inclusive'],
      ['level','Query param','No','One of: Excellent|Good|Average|Needs Improvement','Exact match filter'],
      ['business','Query param','No','Business type string. Partial match.','E.g. "E-commerce"'],
    ]),
    br(),

    h2('3.7  User Authentication APIs'),
    h3('POST /api/user/validate-code'),
    body('Checks that a SharedUserID code exists and isActive=true before allowing registration.'),
    fieldTable([
      ['code','String (body)','Yes','Non-empty. Auto-trim and uppercase before lookup.',''],
    ]),
    genTable(['Scenario','Status','Response'],[
      ['Code valid and active','200','{ success: true, codeId: "<ObjectId>", label: "Batch Name" }'],
      ['Code not found','404','{ success: false, message: "Invalid access code." }'],
      ['Code exists but inactive','403','{ success: false, message: "This access code is no longer active." }'],
    ],[2800,1200,5360],C.green),
    br(),

    h3('POST /api/user/register'),
    body('Registers a new user. Validates all fields. Hashes password. Generates OTP. Sends OTP email.'),
    fieldTable([
      ['codeId','ObjectId (body)','Yes','Must be a valid SharedUserID ObjectId (from validate-code response).','Re-validate isActive on register'],
      ['name','String (body)','Yes','2–100 chars. Trimmed. Letters, spaces, hyphens only.','Stored as entered (not lowercased)'],
      ['email','String (body)','Yes','Valid email format. Must be globally unique in Users collection.','Lowercased before save'],
      ['password','String (body)','Yes','Min 8 chars. Must contain: ≥1 uppercase, ≥1 digit, ≥1 special char.','Hashed before save'],
      ['confirmPassword','String (body)','Yes','Must exactly match password field.','Validation only, not stored'],
    ]),
    genTable(['Scenario','Status','Response'],[
      ['All valid, OTP sent','201','{ success: true, message: "OTP sent to <email>. Valid for 5 minutes." }'],
      ['Email already registered (verified)','409','{ success: false, message: "Email already registered. Please login." }'],
      ['Email registered but unverified','200','{ success: true, message: "OTP resent to <email>." } — resend OTP'],
      ['Invalid code','400','{ success: false, message: "Invalid access code." }'],
      ['Password too weak','400','{ success: false, errors: [{field:"password", message:"..."}] }'],
    ],[2800,1200,5360],C.green),
    br(),

    h3('POST /api/user/verify-otp'),
    body('Verifies the 6-digit OTP sent during registration. Marks user as verified. Returns JWT.'),
    fieldTable([
      ['email','String (body)','Yes','Email address of the registering user.',''],
      ['otp','String (body)','Yes','Exactly 6 numeric digits.',''],
    ]),
    br(),

    h3('POST /api/user/login'),
    body('Authenticates an existing verified user. Generates new JWT. Saves to User.activeToken (overwriting previous — single session enforcement).'),
    fieldTable([
      ['email','String (body)','Yes','Registered, verified email.',''],
      ['password','String (body)','Yes','Plain text. Compared with bcrypt.compare() against passwordHash.',''],
    ]),
    genTable(['Scenario','Status','Response'],[
      ['Valid credentials','200','{ success: true, token: "<JWT>", user: { _id, name, email, sharedCode, hasCompletedAssessment } }'],
      ['Unverified account','403','{ success: false, message: "Please verify your email first." }'],
      ['Wrong password','401','{ success: false, message: "Invalid credentials." }'],
      ['Has completed assessment','200','Returns token + hasCompletedAssessment: true — frontend redirects to result.html'],
    ],[2800,1200,5360],C.green),
    br(),

    h3('POST /api/user/resend-otp'),
    body('Regenerates OTP for unverified users. Enforces 60-second cooldown (check updatedAt of User).'),
    fieldTable([
      ['email','String (body)','Yes','Email of unverified user.',''],
    ]),
    br(),

    h2('3.8  Assessment APIs'),
    h3('GET /api/assessment/questions'),
    body('Returns all 40 active questions grouped by their QuestionType, ordered by Question.order. Answer marks are NEVER included in this response.'),
    note('Response shape: { data: [ { typeId, typeName, typeIcon, typeColor, questions: [ { _id, text, order, options: [ { _id, label, order } ] } ] } ] }'),
    br(),
    critical('The AnswerOption.marks field must be explicitly excluded from this response using Mongoose .select("-marks"). Add a test to your CI pipeline asserting marks is absent from this endpoint.'),
    br(),

    h3('POST /api/assessment/start'),
    body('Creates a new AssessmentSession for the logged-in user. Validates user has not already completed an assessment.'),
    genTable(['Scenario','Status','Response'],[
      ['Session created','201','{ success: true, sessionId: "<ObjectId>", startedAt: "<ISO>", expiresAt: "<ISO>" }'],
      ['Already completed','403','{ success: false, message: "You have already completed this assessment." }'],
      ['Session in progress','409','{ success: false, sessionId: "<existing>", message: "Assessment already in progress." }'],
    ],[3000,1200,5160],C.green),
    br(),

    h3('POST /api/assessment/submit'),
    body('Accepts the complete answers array, validates completeness and timing, calculates scores, saves Result, updates User.hasCompletedAssessment=true.'),
    note(
`Request body:
{
  "sessionId": "<ObjectId>",
  "autoSubmitted": false,
  "answers": [
    { "questionId": "<ObjectId>", "answerOptionId": "<ObjectId>" },
    ... (40 entries required)
  ]
}`
    ),
    genTable(['Validation Rule','Failure Response'],[
      ['answers.length must equal 40','400 — { message: "All 40 questions must be answered." }'],
      ['All questionIds must be active questions','400 — { message: "Invalid question reference." }'],
      ['Each answerOptionId must belong to its questionId','400 — { message: "Invalid answer option for question." }'],
      ['Session must exist and belong to req.user._id','403 — { message: "Session not found or not yours." }'],
      ['Session status must be "in-progress"','400 — { message: "Session already submitted or expired." }'],
      ['Server time must be ≤ session.expiresAt + 30s buffer','400 — { message: "Assessment time has expired." }'],
    ],[4000,5360],C.red),
    br(),

    h3('GET /api/assessment/result'),
    body('Returns the logged-in user\'s saved Result. If not found, returns 404. This is the only endpoint a user can call to retrieve their result.'),
    note('Response: { data: { totalMarks, percentage, level, categoryScores, categoryPercentages, highestCategory, recommendedBusiness, explanation, improvementAreas, user: { name, sharedCode }, createdAt } }'),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: BUSINESS LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
function part4() {
  return [
    h1('PART 4 — BUSINESS LOGIC & SCORING ENGINE'),
    h2('4.1  Score Calculation Algorithm'),
    body('The scoring engine runs entirely server-side in utils/scoreCalculator.js. It is called only inside the POST /api/assessment/submit controller AFTER all validations pass.'),
    br(),
    genTable(['Step','Process','Formula'],[
      ['1. Load answers','Fetch all 40 UserAnswer records for the session with populated AnswerOption.marks and Question.typeId','N/A'],
      ['2. Category grouping','Group answers by QuestionType name','{ [typeName]: [marks] }'],
      ['3. Category raw score','Sum marks within each category','Sum of 5 values, max=25 per category'],
      ['4. Category percentage','Calculate per-category percentage','(categoryScore / 25) × 100'],
      ['5. Total marks','Sum all 8 category scores','Range: 40–200'],
      ['6. Overall percentage','Overall score as percentage','(totalMarks / 200) × 100, toFixed(1)'],
      ['7. Result level','Apply level thresholds (see 4.2)','Level string'],
      ['8. Top categories','Find highest scoring category/categories (handle ties)','Filter all cats where score === Math.max(...)'],
      ['9. Recommendations','Map top categories to business types using BUSINESS_MAP','Array of business type strings'],
      ['10. Improvement areas','Identify 2 lowest scoring categories + generate suggestions','improvementAreas: [{category, score, suggestion}]'],
    ],[500,3500,5360],C.primary),
    br(),

    h2('4.2  Result Level Thresholds'),
    genTable(['Level','Score Range','Percentage Range','Meaning'],[
      ['Excellent','160–200','80%–100%','Strong entrepreneurial personality across most dimensions.'],
      ['Good','120–159','60%–79%','Good entrepreneurial traits with some areas to develop.'],
      ['Average','80–119','40%–59%','Moderate entrepreneurial potential, specific areas need focus.'],
      ['Needs Improvement','40–79','Below 40%','Foundational development needed before entrepreneurial pursuit.'],
    ],[1600,1600,1600,4560],C.gold),
    br(),

    h2('4.3  Business Recommendation Map (BUSINESS_MAP)'),
    genTable(['Psychometric Category','Recommended Business Types'],[
      ['Communication','Consulting · Coaching · Sales Business · Public Speaking Business'],
      ['Creativity','Digital Marketing · Event Management · Content Creation · Design Agency'],
      ['Problem Solving','IT Services · Tech Consulting · Legal Services · Research Firm'],
      ['Leadership','Service Business · Team-based Business · Management Consulting · HR Services'],
      ['Risk Taking','Startup · E-commerce · Trading · Venture Investment · Franchise'],
      ['Financial Awareness','Retail · Franchise · Manufacturing · Accounting Services · Fintech'],
      ['Business Mindset','E-commerce · Scalable Business · Import/Export · B2B Services'],
      ['Teamwork','Event Management · Agency Business · Co-operative Business · Sports Management'],
    ],[2400,6960],C.green),
    br(),
    note('If two or more categories tie for highest score, the recommendedBusiness array will contain the union of all tied categories\' business types, deduplicated.'),
    br(),

    h2('4.4  Improvement Suggestions (Template)'),
    genTable(['Category','Improvement Suggestion Template'],[
      ['Communication','Practice public speaking, join groups like Toastmasters, and work on active listening and written communication skills.'],
      ['Creativity','Engage with design thinking exercises, explore creative hobbies, and practice brainstorming techniques daily.'],
      ['Problem Solving','Take up logic puzzles, study case studies, and practice structured problem-solving frameworks like 5 Whys and SWOT.'],
      ['Leadership','Seek leadership roles in groups, study influential leaders, and work on emotional intelligence and conflict resolution.'],
      ['Risk Taking','Start small calculated risks, study risk management frameworks, and build your risk tolerance incrementally.'],
      ['Financial Awareness','Study personal finance, take basic accounting courses, and practice reading financial statements regularly.'],
      ['Business Mindset','Follow entrepreneurship content, study market trends, develop a customer-centric thinking approach.'],
      ['Teamwork','Participate in team projects, volunteer for collaborative initiatives, and study team dynamics and group psychology.'],
    ],[2000,7360],C.accent),
    br(),

    h2('4.5  OTP Generation Logic (utils/otpGenerator.js)'),
    note(
`function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  return { otp, expiry };
}
// Save otp to user.otpCode and expiry to user.otpExpiry
// Clear both fields after successful verification: user.otpCode = undefined; user.otpExpiry = undefined;`
    ),
    br(),

    h2('4.6  JWT Configuration'),
    genTable(['Token Type','Secret','Expiry','Payload','Storage'],[
      ['Admin JWT','process.env.JWT_SECRET','8 hours','{ id: admin._id, role: "admin" }','localStorage key: adminToken'],
      ['User JWT','process.env.JWT_SECRET','2 hours','{ id: user._id, role: "user" }','localStorage key: userToken'],
    ],[1400,2400,1200,3000,2360],C.primary),
    br(),
    critical('Single-session enforcement: On every login, save the new JWT string to User.activeToken. In the userAuth middleware, after verifying the JWT signature, additionally check: if (decoded.token !== user.activeToken) return 401 Unauthorized. This ensures the previous device is instantly logged out.'),
    br(),

    h2('4.7  Email Templates'),
    genTable(['Email Type','Trigger','Subject Line','Body Content'],[
      ['Registration OTP','POST /user/register','Verify Your Email — Psychometric Assessment','Your OTP is [XXXXXX]. Valid for 5 minutes. Do not share this code.'],
      ['Resend OTP','POST /user/resend-otp','Your New OTP — Psychometric Assessment','A new OTP [XXXXXX] has been generated. Valid for 5 minutes.'],
      ['Admin Login OTP','POST /admin/login','Admin Login OTP','Your admin access OTP is [XXXXXX]. Valid for 5 minutes.'],
      ['Welcome Email','After OTP verification','Welcome to Your Assessment — [Name]','Welcome [Name]! Your account is verified. Your Shared Code is [CODE]. Start your assessment when ready.'],
    ],[2000,2200,2800,2360],C.accent),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: USER APP PAGES
// ═══════════════════════════════════════════════════════════════════════════════
function part5() {
  return [
    h1('PART 5 — USER WEB APPLICATION: PAGE-BY-PAGE SPECIFICATION'),
    note('All user pages use a consistent design system: Tailwind CSS CDN, Inter/DM Sans fonts from Google Fonts, brand color #1B3A6B (primary), #2563EB (accent). No persistent navigation bar or sidebar on any page — each page is self-contained. Page transitions use window.location.href.'),
    br(),

    // PAGE 1: HOME
    h2('5.1  HOME PAGE — user/index.html'),
    sectionLabel('Page Purpose: Entry point. User enters Shared User ID to begin.'),
    br(),
    h3('Layout Structure'),
    body('Full-screen centered layout. Single column. No navigation. Logo at top, hero section, input card, footer text.'),
    br(),
    h3('UI Elements — Complete Field & Button Spec'),
    fieldTable([
      ['App Logo','Image/SVG','No','N/A — decorative','Centered. 80×80px. Alt text: "Psychometric Assessment Platform Logo"'],
      ['App Name Heading','H1 Text','No','N/A','Text: "Discover Your Entrepreneurial Self". 36px bold, color #1B3A6B.'],
      ['Subtitle','Paragraph','No','N/A','Text: "Find out which business type matches your personality in 30 minutes."'],
      ['Shared User ID input','Text input','Yes on Continue','Non-empty after trim. Auto-uppercased on input event.','id="sharedCodeInput". Placeholder: "Enter your access code (e.g. BATCH2024A)". Autocomplete: off.'],
      ['Input error message','Span (hidden)','N/A','Shown when validation fails','id="codeError". Initially display:none. Text in red #DC2626.'],
      ['Continue Button','Button','N/A','Enabled at all times. Validates on click.','id="continueBtn". Full-width. Primary color. Text: "Continue →"'],
      ['Loader Spinner','Div (hidden)','N/A','Shown during API call','Shown inside button or below input. Hides Continue btn text.'],
      ['Already registered link','Anchor text','N/A','N/A','Text: "Already have an account? Login →". href: login.html'],
    ]),
    br(),
    h3('Continue Button Logic (Full Wire)'),
    ...numbered([
      'User clicks "Continue" button.',
      'Disable button. Show spinner.',
      'Read sharedCodeInput.value. Trim. Uppercase.',
      'Client validation: if empty → show error "Please enter your access code." → re-enable button → stop.',
      'Call POST /api/user/validate-code with body { code: uppercasedCode }.',
      'On HTTP 200 (valid code): Save returned codeId to sessionStorage key "pendingCodeId". Save code string to sessionStorage key "pendingCode". Redirect to register.html.',
      'On HTTP 404: Show error "Invalid access code. Please check with your coordinator."',
      'On HTTP 403: Show error "This access code has been deactivated. Please contact your coordinator."',
      'On network error: Show error "Connection error. Please try again."',
      'Always re-enable button and hide spinner after response.',
    ]),
    br(),

    // PAGE 2: REGISTER
    h2('5.2  REGISTER PAGE — user/register.html'),
    sectionLabel('Page Purpose: New user registration form with real-time validation.'),
    br(),
    body('On page load: Read pendingCodeId and pendingCode from sessionStorage. If either is missing, redirect immediately to index.html. Display the code in a readonly badge at top of form.'),
    br(),
    h3('UI Elements — Complete Field & Button Spec'),
    fieldTable([
      ['Access Code Badge','Readonly display','N/A','N/A','Shows "Access Code: [CODE]" in blue badge. Data from sessionStorage.'],
      ['Full Name input','Text input','Yes','2–100 chars. Letters, spaces, hyphens only. Regex: /^[a-zA-Z\\s\\-\']+$/','id="nameInput". Placeholder: "Enter your full name". Autocomplete: name.'],
      ['Email input','Email input','Yes','Valid email format. Regex: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/','id="emailInput". Placeholder: "your@email.com". Autocomplete: email. Lowercased before API call.'],
      ['Password input','Password input','Yes','Min 8 chars, ≥1 uppercase, ≥1 digit, ≥1 special char (@$!%*?&)','id="passwordInput". Placeholder: "Create a strong password". Has toggle show/hide eye icon.'],
      ['Password Strength Meter','Progress bar','N/A','Visual only — updates on keyup','id="strengthMeter". 4 levels: Weak (red), Fair (orange), Good (yellow), Strong (green). Evaluated by regex.'],
      ['Password strength label','Span text','N/A','N/A','id="strengthLabel". Shows: "Weak" / "Fair" / "Good" / "Strong"'],
      ['Confirm Password input','Password input','Yes','Must exactly match password field. Validated on blur.','id="confirmInput". Placeholder: "Re-enter your password". Has toggle show/hide.'],
      ['Match indicator','Span','N/A','N/A','Shows green checkmark if match, red X if mismatch. Updates on keyup.'],
      ['Error messages','Spans per field','N/A','One below each input field','id: nameError, emailError, passwordError, confirmError. Initially hidden.'],
      ['Register Button','Button','N/A','Disabled until all real-time validations pass.','id="registerBtn". Text: "Create Account & Send OTP". Full-width primary.'],
      ['Loader','Div','N/A','Shown during API call','Replaces button text with spinner.'],
      ['Back link','Anchor','N/A','N/A','Text: "← Change access code". href: index.html'],
    ]),
    br(),
    h3('Register Button Logic (Full Wire)'),
    ...numbered([
      'Run full client-side validation on all 4 fields. Show inline errors for each failing field. Stop if any fail.',
      'Disable button. Replace text with loading spinner.',
      'Call POST /api/user/register with body { codeId: sessionStorage.pendingCodeId, name: trimmedName, email: lowercasedEmail, password }.',
      'On HTTP 201 (OTP sent): Save email to sessionStorage "pendingEmail". Save name to sessionStorage "pendingName". Redirect to otp-register.html.',
      'On HTTP 409 (email exists, verified): Show error below email field: "This email is already registered. Login instead." Show login link.',
      'On HTTP 200 (email exists, unverified): Save email to sessionStorage. Redirect to otp-register.html with note "OTP resent."',
      'On HTTP 400 (validation error): Parse errors array. Show each field-level error in corresponding error span.',
      'Always re-enable button and restore text after response.',
    ]),
    br(),

    // PAGE 3: OTP REGISTER
    h2('5.3  OTP VERIFICATION PAGE — user/otp-register.html'),
    sectionLabel('Page Purpose: Email OTP verification after registration.'),
    br(),
    body('On page load: Read pendingEmail from sessionStorage. If missing, redirect to index.html. Display email address (partially masked: "j***@gmail.com") in instructional text.'),
    br(),
    h3('UI Elements'),
    fieldTable([
      ['OTP Digit Inputs','6 × separate text inputs','Yes','Numeric only (0-9). MaxLength: 1 per input.','id: otp1 through otp6. Auto-focus next input on digit entry. Auto-focus prev on backspace.'],
      ['Hidden full OTP field','Hidden input','N/A','Assembled from 6 inputs for API call','id="otpValue". Value updated on each digit input event.'],
      ['OTP error message','Span','N/A','Shown on invalid/expired OTP','id="otpError". Initially hidden.'],
      ['Verify Button','Button','N/A','Enabled only when all 6 digits are filled.','id="verifyBtn". Text: "Verify Email". Disabled while inputs incomplete.'],
      ['Resend OTP link/button','Button','N/A','Disabled for first 60 seconds (countdown shown).','id="resendBtn". Calls POST /api/user/resend-otp. Shows "Resend OTP (60s)" countdown.'],
      ['Countdown timer','Span','N/A','Counts down from 60 to 0. Enables resend when 0.','id="resendTimer". Format: "(59s)", "(58s)" etc.'],
      ['Back link','Anchor','N/A','N/A','Text: "← Back to registration". href: register.html'],
    ]),
    br(),
    h3('OTP Input Auto-behavior'),
    ...bullets([
      'On digit keypress: Accept only 0-9. Move focus to next input automatically.',
      'On backspace: If current input is empty, move focus to previous input.',
      'On paste: Detect 6-digit string. Distribute digits across all 6 inputs automatically. Trigger verify if complete.',
      'On all 6 filled: Enable Verify button. Optionally auto-submit after 0.5s delay.',
    ]),
    br(),
    h3('Verify Button Logic'),
    ...numbered([
      'Assemble 6 digits into single string.',
      'Validate: must be exactly 6 numeric digits.',
      'Call POST /api/user/verify-otp with { email: sessionStorage.pendingEmail, otp: "XXXXXX" }.',
      'On 200 success: Save returned JWT to localStorage key "userToken". Save user object to localStorage key "userData". Clear sessionStorage (pendingEmail, pendingCode, pendingCodeId, pendingName). Redirect to welcome.html.',
      'On 400 (invalid/expired OTP): Show error in otpError span. Clear all 6 inputs. Focus first input.',
    ]),
    br(),

    // PAGE 4: LOGIN
    h2('5.4  LOGIN PAGE — user/login.html'),
    sectionLabel('Page Purpose: Returning user authentication.'),
    br(),
    fieldTable([
      ['App Logo','Image','No','N/A','Same as index.html. Smaller (48px).'],
      ['Page title','H2','No','N/A','"Welcome Back"'],
      ['Email input','Email input','Yes','Valid email format. Non-empty.','id="emailInput". Placeholder: "your@email.com". Autocomplete: email.'],
      ['Password input','Password input','Yes','Non-empty.','id="passwordInput". Placeholder: "Your password". Has show/hide toggle.'],
      ['Email error span','Span','N/A','N/A','id="emailError". Hidden until triggered.'],
      ['Password error span','Span','N/A','N/A','id="passwordError". Hidden until triggered.'],
      ['Login Button','Button','N/A','Always enabled. Validates on click.','id="loginBtn". Text: "Login". Full-width primary.'],
      ['Loader','Div','N/A','Shown during API call','Replaces button content.'],
      ['Register redirect','Anchor','N/A','N/A','"Don\'t have an account? Register →". href: index.html'],
    ]),
    br(),
    h3('Login Button Logic'),
    ...numbered([
      'Validate: email format, password non-empty. Show errors if invalid.',
      'Call POST /api/user/login with { email, password }.',
      'On 200: Save JWT to localStorage "userToken". Save user object to localStorage "userData".',
      'If user.hasCompletedAssessment === true: Redirect to result.html.',
      'If user.hasCompletedAssessment === false: Redirect to welcome.html.',
      'On 401: Show "Invalid email or password." below password field.',
      'On 403: Show "Please verify your email first." with "Resend OTP" link.',
    ]),
    br(),

    // PAGE 5: WELCOME
    h2('5.5  WELCOME / PRE-ASSESSMENT PAGE — user/welcome.html'),
    sectionLabel('Page Purpose: Display assessment instructions before starting.'),
    br(),
    body('On page load: Check localStorage for valid userToken. If missing, redirect to login.html. If user.hasCompletedAssessment === true, redirect to result.html. Read user name from localStorage.userData.'),
    br(),
    fieldTable([
      ['Welcome heading','H2','No','N/A','"Welcome, [user.name]! 👋"'],
      ['Assessment overview card','Info card','No','N/A','Contains: Total Questions: 40 · Categories: 8 · Time Limit: 30 Minutes · Points per question: 1–5'],
      ['Instructions list','Ordered list','No','N/A','See instruction list below.'],
      ['Important notes','Warning card','No','N/A','Yellow warning box with key rules.'],
      ['User info display','Readonly card','No','N/A','Shows: "Your Shared Code: [code]" · "Logged in as: [email]"'],
      ['Start Assessment Button','Button','N/A','N/A','id="startBtn". Full-width. Primary. Text: "Start Assessment →". Large (18px).'],
      ['Logout link','Anchor/Button','N/A','N/A','Text: "Logout". Clears localStorage, redirects to login.html.'],
    ]),
    br(),
    h3('Assessment Instructions (to display as numbered list)'),
    ...numbered([
      'This assessment contains 40 questions across 8 personality categories.',
      'Each question has 5 answer options from "Strongly Agree" to "Strongly Disagree".',
      'Answer honestly — there are no right or wrong answers.',
      'You must answer ALL questions. You cannot skip or leave any question blank.',
      'You have 30 minutes to complete the assessment.',
      'A warning will appear when 5 minutes remain.',
      'If time runs out, your answered questions are automatically submitted.',
      'You can navigate back to previous questions using the "Previous" button.',
      'Your result will be displayed immediately after submission.',
      'You can only take this assessment ONCE. Results cannot be changed after submission.',
    ]),
    br(),
    h3('Start Assessment Button Logic'),
    ...numbered([
      'Disable button. Show loading state.',
      'Call POST /api/assessment/start with Authorization: Bearer <userToken>.',
      'On 201 success: Save sessionId to sessionStorage "assessmentSessionId". Save expiresAt to sessionStorage "assessmentExpiry". Redirect to assessment.html.',
      'On 403 (already completed): Alert "You have already completed this assessment." Redirect to result.html.',
      'On 409 (in progress): Save returned sessionId to sessionStorage. Redirect to assessment.html (resume mode).',
      'On auth error (401): Clear localStorage. Redirect to login.html.',
    ]),
    br(),

    // PAGE 6: ASSESSMENT
    h2('5.6  ASSESSMENT PAGE — user/assessment.html'),
    sectionLabel('Page Purpose: Core assessment engine — 40 questions, timer, navigation, auto-submit.'),
    br(),
    warn('This is the most complex page. Read this entire section before building. The layout has 3 zones: Left Sidebar, Top Bar, Main Content Area.'),
    br(),

    h3('Page Load Logic'),
    ...numbered([
      'Check localStorage for userToken. If missing → login.html.',
      'Check sessionStorage for assessmentSessionId. If missing → welcome.html.',
      'Calculate remaining time: expiresAt - Date.now(). If ≤ 0 → call auto-submit immediately.',
      'Call GET /api/assessment/questions. Parse and store full questions array in JS variable (not sessionStorage — too large).',
      'Restore saved answers from sessionStorage key "draftAnswers" (JSON object { questionId: answerOptionId }).',
      'Initialise timer with remaining milliseconds.',
      'Render question #1 (or last unanswered question if restoring draft).',
      'Update left sidebar category statuses.',
    ]),
    br(),

    h3('Left Sidebar — Category Progress Tracker'),
    body('Fixed 250px wide sidebar on desktop. Collapses to top horizontal strip on mobile (< 768px).'),
    fieldTable([
      ['Sidebar container','Div','No','N/A','id="categorySidebar". Fixed left. Full height. Background: #1B3A6B. Text: white.'],
      ['App logo mini','SVG/img','No','N/A','Small logo + "Psychometric Assessment" text. Top of sidebar.'],
      ['Category items (×8)','List items','No','N/A','One per QuestionType. Each shows: icon + category name + "(X/5)" answered count.'],
      ['Active category indicator','CSS highlight','N/A','Dynamic','Currently active category highlighted with #2563EB left border and lighter background.'],
      ['Completed category badge','Green checkmark','N/A','Dynamic','✅ shown when all 5 questions in that category are answered.'],
      ['Progress bar per category','Mini progress bar','N/A','Dynamic','Small bar (0–100%) showing answered/total for that category.'],
    ]),
    br(),

    h3('Top Bar'),
    fieldTable([
      ['Question counter','Span','No','N/A','id="questionCounter". Text: "Question 12 of 40". Updated on every navigation.'],
      ['Category label','Span','No','N/A','id="categoryLabel". Shows current category name. E.g. "Category: Creativity (3/8)"'],
      ['Timer display','Div','Yes','N/A','id="timerDisplay". Format: "MM:SS". Large bold font. Right-aligned.'],
      ['Timer warning state','CSS class','N/A','Triggered at 5:00 remaining','Adds class "timer-warning": text turns red #DC2626, pulsing animation.'],
      ['Warning popup','Modal/Toast','N/A','Shown once at 5:00 mark','id="timeWarningModal". Message: "⚠️ 5 minutes remaining! Please complete and submit."'],
    ]),
    br(),

    h3('Main Content Area'),
    fieldTable([
      ['Category name banner','H3','No','N/A','id="currentCategoryName". Shows category of current question. E.g. "💬 Communication"'],
      ['Question number','Span','No','N/A','id="questionNumber". E.g. "Question 3 of 5 in this category"'],
      ['Question text','H2/P','No','N/A','id="questionText". Large, readable. Min 18px. Wraps properly on mobile.'],
      ['Answer options (×5)','Radio inputs','Yes','At least one must be selected to proceed (except Q1–Q39 allow skipping with back nav)','id: option1 through option5. Each is a full-width clickable card (not just radio circle). Selected state: blue border + blue background tint.'],
      ['Option labels','Labels','No','N/A','Full Likert scale text. E.g. "Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree". No marks shown.'],
      ['Answer option IDs','Hidden','N/A','N/A','The AnswerOption._id is stored in data-option-id attribute. Used for submission payload.'],
      ['Previous Button','Button','N/A','Hidden on Q1. Enabled from Q2 onward.','id="prevBtn". Text: "← Previous". Secondary style. Navigates to previous question, preserving current selection.'],
      ['Next Button','Button','N/A','Disabled if no answer selected for current question. Visible on Q1–Q39.','id="nextBtn". Text: "Next →". Primary style. Only enabled after option selection.'],
      ['Submit Button','Button','N/A','Visible ONLY on Q40. Disabled until option selected.','id="submitBtn". Text: "Submit Assessment". Green. Replaces Next on Q40.'],
      ['Answer change note','Small text','No','N/A','Below options: "You can change your answer by selecting a different option. Use ← Previous to go back."'],
    ]),
    br(),

    h3('Answer State Management'),
    note(
`// In-memory object storing all answers
let draftAnswers = {}; // { questionId: answerOptionId }

// On option click:
draftAnswers[currentQuestion._id] = selectedAnswerOptionId;
sessionStorage.setItem('draftAnswers', JSON.stringify(draftAnswers));
updateSidebarProgress();
enableNextOrSubmitButton();

// Navigation:
function goToQuestion(index) {
  currentQuestionIndex = index;
  renderQuestion(); // restore previously selected option if draftAnswers has it
  updateTopBar();
  updateSidebar();
}`
    ),
    br(),

    h3('Timer Logic (utils/timer.js)'),
    note(
`function startTimer(expiresAt) {
  const expiryTime = new Date(expiresAt).getTime();
  
  const interval = setInterval(() => {
    const remaining = expiryTime - Date.now();
    
    if (remaining <= 0) {
      clearInterval(interval);
      autoSubmitAssessment(); // Submit with whatever is answered
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerDisplay.textContent = \`\${String(minutes).padStart(2,'0')}:\${String(seconds).padStart(2,'0')}\`;
    
    if (remaining <= 300000 && !warningShown) { // 5 minutes
      showTimeWarning();
      timerDisplay.classList.add('timer-warning');
      warningShown = true;
    }
  }, 1000);
}`
    ),
    br(),

    h3('Auto-Submit Logic'),
    ...numbered([
      'Timer reaches 0:00.',
      'Collect all answered questions from draftAnswers.',
      'For unanswered questions: skip them (do NOT fabricate answers).',
      'If fewer than 40 questions answered: send partial answers with autoSubmitted: true flag.',
      'Server validates: accepts partial submissions when autoSubmitted=true (but still saves all received answers).',
      'Navigate to result.html after receiving resultId.',
    ]),
    br(),

    h3('Manual Submit Button Logic (Q40)'),
    ...numbered([
      'User selects option on Q40.',
      'Submit button becomes enabled.',
      'User clicks Submit.',
      'Show confirmation modal: "Are you sure you want to submit? This cannot be undone." with Cancel and Confirm buttons.',
      'On Confirm: Disable all inputs. Build answers array from draftAnswers. Call POST /api/assessment/submit.',
      'Show full-screen loading overlay: "Calculating your results..." with animated loader.',
      'On success: Clear sessionStorage (assessmentSessionId, assessmentExpiry, draftAnswers). Redirect to result.html.',
      'On error: Show error toast. Re-enable submit button. Log error to console.',
    ]),
    br(),

    // PAGE 7: RESULT
    h2('5.7  RESULT PAGE — user/result.html'),
    sectionLabel('Page Purpose: Display personalised psychometric assessment results.'),
    br(),
    body('On page load: Check userToken in localStorage. Call GET /api/assessment/result. If 404 (no result yet), redirect to welcome.html. Parse and render result data.'),
    br(),
    h3('Page Sections — Top to Bottom'),
    fieldTable([
      ['Result Header Card','Full-width card','No','N/A','Background: gradient from #1B3A6B to #2563EB. White text. Contains: "Your Results, [name]" heading + "Shared Code: [code]" + date completed.'],
      ['Score Hero Section','3-col stat cards','No','N/A','Card 1: Total Score "[X] / 200". Card 2: Percentage "[X]%". Card 3: Level badge "[Excellent/Good/Average/Needs Improvement]" with color coding.'],
      ['Level explanation','Short paragraph','No','N/A','Brief description of what their level means. Template from Part 4.'],
      ['Category Breakdown heading','H3','No','N/A','"Your Personality Profile"'],
      ['Category scores chart','Horizontal bar chart','No','N/A','Chart.js horizontal bar chart. One bar per category. X-axis: 0–25 (max per category). Bars colored per category color. Labels show score + percentage.'],
      ['Category score table','Data table','No','N/A','8 rows. Columns: Category | Score (/25) | Percentage | Level. Sorted by score descending.'],
      ['Top Category highlight','Highlighted card','No','N/A','Blue card: "Your Strongest Trait: [Category Name]". If tie: "Your Strongest Traits: [Cat1] and [Cat2]".'],
      ['Business Recommendation heading','H2','No','N/A','"Recommended Business Types for You 🚀"'],
      ['Business cards','Grid of cards (2-col)','No','N/A','One card per recommended business. Each shows: business name + 2-line description + relevant icon. If multiple, grid layout.'],
      ['Explanation paragraph','P text','No','N/A','Full personalised explanation from Result.explanation field.'],
      ['Improvement Areas heading','H3','No','N/A','"Areas to Develop 📈"'],
      ['Improvement cards','2 cards','No','N/A','One per bottom-2 categories. Shows: category name + improvement suggestion from improvementAreas array.'],
      ['Share section','Card','No','N/A','"Share Your Result" with copy-to-clipboard button (copies summary text). Note: No PDF or CSV export for users.'],
      ['Logout button','Button','No','N/A','Text: "Logout". Bottom of page. Clears localStorage. Redirects to login.html.'],
    ]),
    br(),
    critical('ZERO export buttons on the result page. No PDF button. No CSV button. No print button. This is a hard business rule.'),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6: ADMIN APP PAGES
// ═══════════════════════════════════════════════════════════════════════════════
function part6() {
  return [
    h1('PART 6 — ADMIN APPLICATION: PAGE-BY-PAGE SPECIFICATION'),
    note('Admin pages share a persistent LEFT SIDEBAR for navigation. The sidebar is included on every page EXCEPT login.html and otp.html. No top navigation bar. Sidebar is collapsible on mobile.'),
    br(),

    h2('6.1  ADMIN LEFT SIDEBAR — Shared Component'),
    sectionLabel('Present on ALL admin pages except login and OTP pages.'),
    br(),
    fieldTable([
      ['Sidebar container','Fixed div','No','N/A','id="adminSidebar". Fixed left. Width: 260px. Height: 100vh. Background: #1B3A6B. Overflow-y: auto.'],
      ['Logo area','Top section','No','N/A','App logo (40px) + "Admin Panel" text. White. Centered. Bottom border separator.'],
      ['Admin name display','Span','No','N/A','Shows logged-in admin email. Bottom of logo area.'],
      ['Dashboard link','Nav item','N/A','Active state on dashboard.html','Icon: 📊 · Text: "Dashboard" · href: dashboard.html'],
      ['Shared User IDs link','Nav item','N/A','Active state on shared-ids.html','Icon: 🔑 · Text: "Shared User IDs" · href: shared-ids.html'],
      ['Question Types link','Nav item','N/A','Active state on question-types.html','Icon: 🧠 · Text: "Question Types" · href: question-types.html'],
      ['Questions link','Nav item','N/A','Active state on questions.html','Icon: ❓ · Text: "Questions" · href: questions.html'],
      ['Answer Options link','Nav item','N/A','Active state on answer-options.html','Icon: 📝 · Text: "Answer Options" · href: answer-options.html'],
      ['Results link','Nav item','N/A','Active state on results.html','Icon: 📈 · Text: "Results" · href: results.html'],
      ['Logout button','Button','N/A','At bottom of sidebar','Icon: 🚪 · Text: "Logout" · Clears adminToken from localStorage, calls POST /api/admin/logout, redirects to login.html.'],
    ]),
    br(),
    body('Active state style: background #2563EB (or lighter highlight), white text, left border 4px white.'),
    br(),

    h2('6.2  ADMIN LOGIN PAGE — admin/login.html'),
    sectionLabel('No sidebar. Full-screen centered card.'),
    br(),
    fieldTable([
      ['Logo','Image','No','N/A','Centered 80px logo.'],
      ['Page title','H2','No','N/A','"Admin Portal Login"'],
      ['Email input','Email input','Yes','Valid email format','id="adminEmail". Placeholder: "admin@yourdomain.com". Autocomplete: email.'],
      ['Password input','Password input','Yes','Non-empty','id="adminPassword". Placeholder: "Admin password". Has show/hide toggle.'],
      ['Email error','Span','N/A','N/A','id="emailError". Hidden initially.'],
      ['Password error','Span','N/A','N/A','id="passwordError". Hidden initially.'],
      ['General error','Div','N/A','Shown for wrong credentials','id="loginError". Red alert box. Hidden initially.'],
      ['Login Button','Button','N/A','Validates on click','id="loginBtn". Text: "Login & Send OTP". Full-width. Primary.'],
      ['Loader','Div','N/A','During API call','Replaces button content.'],
    ]),
    br(),
    h3('Login Button Logic'),
    ...numbered([
      'Validate email format and password non-empty.',
      'Call POST /api/admin/login.',
      'On 200: Save email to sessionStorage "adminPendingEmail". Redirect to otp.html.',
      'On 401: Show "Invalid email or password." in loginError div.',
    ]),
    br(),

    h2('6.3  ADMIN OTP PAGE — admin/otp.html'),
    sectionLabel('No sidebar. Same OTP UI pattern as user OTP page.'),
    br(),
    fieldTable([
      ['OTP inputs (×6)','Text inputs','Yes','Numeric, maxlength 1 each','id: adminOtp1–adminOtp6. Same auto-focus/backspace behavior as user OTP page.'],
      ['OTP error','Span','N/A','N/A','id="otpError". Hidden initially.'],
      ['Verify Button','Button','N/A','Enabled when all 6 filled','id="verifyBtn". Text: "Verify & Access Dashboard".'],
      ['Resend timer','Span','N/A','60-second cooldown','id="resendTimer". Calls POST /api/admin/login again with saved email.'],
      ['Resend button','Button','N/A','Disabled 60 seconds','id="resendBtn". Text: "Resend OTP".'],
    ]),
    br(),
    h3('Verify Button Logic'),
    ...numbered([
      'Call POST /api/admin/verify-otp with { email: sessionStorage.adminPendingEmail, otp }.',
      'On 200: Save JWT to localStorage "adminToken". Save { email } to localStorage "adminData". Clear sessionStorage. Redirect to dashboard.html.',
      'On 400: Show error. Clear inputs. Focus first input.',
    ]),
    br(),

    h2('6.4  ADMIN DASHBOARD — admin/dashboard.html'),
    sectionLabel('Main analytics overview. First page after admin login.'),
    br(),
    body('On page load: Check adminToken in localStorage. If missing → login.html. Call GET /api/admin/dashboard. Render all cards and charts.'),
    br(),
    h3('KPI Summary Cards (Row 1 — 3 cards wide)'),
    fieldTable([
      ['Total Registered Users','Stat card','No','N/A','Number from cards.totalUsersRegistered. Icon: 👥. Blue background.'],
      ['Completed Assessments','Stat card','No','N/A','cards.totalAssessmentsCompleted. Icon: ✅. Green background.'],
      ['Assessments In Progress','Stat card','No','N/A','cards.totalAssessmentsInProgress. Icon: ⏳. Yellow background.'],
    ]),
    br(),
    h3('KPI Summary Cards (Row 2 — 4 cards wide)'),
    fieldTable([
      ['Average Score','Stat card','No','N/A','cards.averageScore out of 200. Icon: 📊. Formatted to 1 decimal.'],
      ['Highest Score','Stat card','No','N/A','cards.highestScore. Icon: 🏆. Gold styling.'],
      ['Lowest Score','Stat card','No','N/A','cards.lowestScore. Icon: 📉. Red styling.'],
      ['Active Shared Codes','Stat card','No','N/A','cards.activeSharedCodes. Icon: 🔑. Blue styling.'],
    ]),
    br(),
    h3('Charts Row'),
    fieldTable([
      ['Assessments per Day bar chart','Chart.js Bar','No','N/A','id="dailyBarChart". Left half. Last 30 days. X-axis: dates. Y-axis: count. Blue bars. Title: "Assessments Over Last 30 Days".'],
      ['Business Distribution doughnut','Chart.js Doughnut','No','N/A','id="businessPieChart". Right half. Segments = business types. Legend below chart. Title: "Business Recommendation Distribution".'],
    ]),
    br(),
    h3('Recent Results Table'),
    genTable(['Column','Data Source','Notes'],[
      ['#','Row number','Auto-incremented'],
      ['Name','user.name','Clickable — links to that user\'s result detail'],
      ['Email','user.email',''],
      ['Shared Code','user.sharedCode',''],
      ['Score','result.totalMarks + " / 200"',''],
      ['%','result.percentage + "%"','Color-coded: green ≥80%, blue ≥60%, yellow ≥40%, red <40%'],
      ['Level','result.level','Badge with color matching level'],
      ['Top Category','result.highestCategory.join(", ")',''],
      ['Recommended','result.recommendedBusiness.slice(0,2).join(", ")','Truncated for table, full on detail view'],
      ['Date','result.createdAt formatted as DD/MM/YYYY',''],
      ['Status','result.level badge',''],
    ],[2400,3000,4360],C.primary),
    br(),
    h3('Dashboard Buttons & Actions'),
    btnTable([
      ['"View All Results"','Click','Always enabled','href: results.html'],
      ['"Export PDF"','Click','Always enabled','Calls GET /api/admin/export/pdf. Triggers file download.'],
      ['"Export CSV"','Click','Always enabled','Calls GET /api/admin/export/csv. Triggers file download.'],
      ['"Refresh"','Click','Always enabled','Re-calls GET /api/admin/dashboard. Updates all cards and charts.'],
    ]),
    br(),

    h2('6.5  SHARED USER IDs PAGE — admin/shared-ids.html'),
    sectionLabel('CRUD management for assessment access codes.'),
    br(),
    h3('Page Top Bar'),
    fieldTable([
      ['Page title','H2','No','N/A','"Shared User IDs"'],
      ['Search input','Text input','No','Searches code and label fields','id="searchInput". Placeholder: "Search by code or label...". Triggers re-render on keyup with 300ms debounce.'],
      ['Filter: Active only','Checkbox','No','N/A','id="filterActive". Label: "Show active only". Filters list on change.'],
      ['Create New ID button','Button','N/A','Always enabled','id="createBtn". Text: "+ Create New ID". Primary. Opens create modal.'],
    ]),
    br(),
    h3('Shared User IDs Table'),
    genTable(['Column','Data','Notes'],[
      ['Code','sharedUserID.code','Monospace font. Bold.'],
      ['Label','sharedUserID.label',''],
      ['Status','isActive badge','Green "Active" or Red "Inactive" badge.'],
      ['Usage Count','sharedUserID.usageCount','Number of users registered with this code.'],
      ['Created By','admin email','From createdBy reference (populated).'],
      ['Created At','createdAt formatted','DD/MM/YYYY HH:MM'],
      ['Actions','Button group','Edit button + Toggle Active/Inactive button + View Users button'],
    ],[2000,2500,5060],C.primary),
    br(),
    h3('Create / Edit Modal Fields'),
    fieldTable([
      ['Code','Text input','Yes (Create only)','[A-Z0-9], 4–20 chars. Auto-uppercased.','Readonly on edit (code cannot be changed after creation).'],
      ['Label','Text input','Yes','3–100 chars.','Editable on both create and edit.'],
      ['isActive','Toggle/Checkbox','No','Boolean','Default: true on create. Editable on edit.'],
      ['Save button','Button','N/A','N/A','Text: "Create" or "Save Changes". Calls POST or PUT accordingly.'],
      ['Cancel button','Button','N/A','N/A','Closes modal without saving.'],
    ]),
    br(),
    btnTable([
      ['"Edit"','Click per row','Always enabled','Opens edit modal pre-filled with row data. PUT /api/admin/shared-ids/:id on save.'],
      ['"Deactivate" / "Activate"','Click per row','Always enabled','Toggles isActive. PUT /api/admin/shared-ids/:id with { isActive: !current }. Refreshes row in table.'],
      ['"View Users"','Click per row','Always enabled','Opens modal or navigates to filtered results page showing all users with this code.'],
      ['"Create New ID"','Click header btn','Always enabled','Opens create modal. POST /api/admin/shared-ids on save.'],
    ]),
    br(),

    h2('6.6  QUESTION TYPES PAGE — admin/question-types.html'),
    sectionLabel('Manage the 8 psychometric categories.'),
    br(),
    h3('Page Elements'),
    fieldTable([
      ['Page title','H2','No','N/A','"Question Types (Categories)"'],
      ['Count badge','Span','No','N/A','Shows "X of 8 active". e.g. "8 of 8 active".'],
      ['Add Question Type button','Button','N/A','N/A','"+ Add Question Type". Only active if fewer than 8 types exist.'],
      ['Question types list','Card list','No','N/A','Draggable for reordering. Each card shows icon, name, description, question count, active status.'],
    ]),
    br(),
    h3('Create / Edit Modal'),
    fieldTable([
      ['Name','Text input','Yes','2–60 chars. Unique.','E.g. "Communication"'],
      ['Description','Textarea','Yes','10–300 chars.','Admin-only context for this category.'],
      ['Icon','Text input','No','Single emoji or empty.','E.g. "💬". Shown in sidebar and charts.'],
      ['Color','Color input','No','Hex color.','#RRGGBB format. Shown in charts.'],
      ['Order','Number input','Yes','1–8. Unique.','Controls assessment display order.'],
      ['isActive toggle','Toggle','No','Boolean. Default: true.','Inactive = excluded from assessments.'],
      ['Save button','Button','N/A','N/A','POST or PUT accordingly.'],
      ['Cancel button','Button','N/A','N/A','Close modal.'],
    ]),
    br(),

    h2('6.7  QUESTIONS PAGE — admin/questions.html'),
    sectionLabel('Create, view, edit, and deactivate assessment questions.'),
    br(),
    h3('Page Top Bar'),
    fieldTable([
      ['Page title','H2','No','N/A','"Questions"'],
      ['Category filter','Select dropdown','No','Filters by QuestionType','id="typeFilter". Options: "All Categories" + each QuestionType name. On change: re-fetch with ?typeId= param.'],
      ['Status filter','Select dropdown','No','N/A','Options: "All", "Active only", "Inactive only".'],
      ['Search input','Text input','No','Searches question text','Placeholder: "Search question text..."'],
      ['Add Question button','Button','N/A','N/A','"+ Add Question". Opens create modal.'],
      ['Questions per category counter','Inline labels','No','N/A','Shows "(X/5 questions)" per category next to category filter.'],
    ]),
    br(),
    h3('Questions Table'),
    genTable(['Column','Data','Notes'],[
      ['#','Question.order','Global order number'],
      ['Category','QuestionType.name','Colored badge matching category color.'],
      ['Question Text','Question.text','Truncated to 100 chars with "..." if longer. Full text in tooltip.'],
      ['Status','isActive','Green "Active" / Red "Inactive" badge.'],
      ['Options','Count','Number of AnswerOptions linked. Should always be 5.'],
      ['Actions','Buttons','Edit | Toggle Active | View Options'],
    ],[800,1800,3000,1200,1000,2560],C.primary),
    br(),
    h3('Create / Edit Question Modal'),
    fieldTable([
      ['Category (Type)','Select dropdown','Yes','Must select active QuestionType. Show warning if category already has 5 active Qs.','Populated from GET /api/admin/question-types'],
      ['Question Text','Textarea','Yes','10–500 chars. Non-empty after trim.','Rows: 4. Char counter below.'],
      ['Order','Number input','Yes','Integer 1–40. Must be unique across active questions.','Server validates uniqueness.'],
      ['isActive','Toggle','No','Default: true.',''],
      ['Save button','Button','N/A','N/A','POST or PUT.'],
      ['Cancel button','Button','N/A','N/A','Close modal.'],
    ]),
    br(),
    warn('If a category already has 5 active questions and admin tries to add another, show error: "This category already has 5 active questions. Deactivate one before adding." Do NOT allow save.'),
    br(),

    h2('6.8  ANSWER OPTIONS PAGE — admin/answer-options.html'),
    sectionLabel('Manage the 5 answer options and their marks for each question.'),
    br(),
    body('This page shows a two-panel layout: Left: Questions list (filtered by category). Right: Answer options for the selected question.'),
    br(),
    h3('Left Panel — Questions List'),
    fieldTable([
      ['Category filter','Select dropdown','No','Filters questions by category','Populated from question types.'],
      ['Questions list','Clickable list items','No','N/A','Each item shows question order + truncated text. Click to load options in right panel.'],
      ['Active question highlight','CSS','N/A','Currently selected question','Blue left border + light background.'],
    ]),
    br(),
    h3('Right Panel — Answer Options'),
    fieldTable([
      ['Selected question display','P text','No','N/A','Full question text at top of right panel.'],
      ['Options count badge','Span','No','N/A','Shows "X / 5 options configured". Red if < 5.'],
      ['Answer options table','Table','No','N/A','5 rows (or fewer if not all created yet). Columns: Order, Label, Marks, Actions.'],
      ['Marks column','Number display','No','Admin sees marks','Shows integer 1–5. NOTE: Admin CAN see marks; this column is excluded only from USER-facing APIs.'],
      ['Add Option button','Button','N/A','Shown only if < 5 options exist for selected question','Text: "+ Add Option". Opens add modal.'],
      ['Edit button','Button per row','N/A','N/A','Opens edit modal pre-filled with option data.'],
      ['Delete button','Button per row','N/A','Only shown if question has no sessions','Deletes option. Confirmation required.'],
    ]),
    br(),
    h3('Create / Edit Answer Option Modal'),
    fieldTable([
      ['Label','Text input','Yes','2–100 chars.','E.g. "Strongly Agree". Shown to users.'],
      ['Marks','Number input','Yes','Integer 1–5. Must be unique within question.','E.g. 5 for Strongly Agree. NOT shown to users.'],
      ['Order','Number input','Yes','Integer 1–5. Controls display sequence.',''],
      ['Save button','Button','N/A','N/A','POST or PUT.'],
      ['Cancel button','Button','N/A','N/A','Close modal.'],
    ]),
    br(),

    h2('6.9  RESULTS PAGE — admin/results.html'),
    sectionLabel('Full results management: search, filter, view, export.'),
    br(),
    h3('Search & Filter Bar'),
    fieldTable([
      ['Search input','Text input','No','Searches name, email, sharedCode fields','id="searchInput". Placeholder: "Search by name, email, or access code...". Debounced 400ms.'],
      ['Date From','Date input','No','ISO date. Inclusive.','id="dateFrom". Label: "From Date".'],
      ['Date To','Date input','No','ISO date. Inclusive.','id="dateTo". Label: "To Date".'],
      ['Level filter','Select dropdown','No','Options: All Levels, Excellent, Good, Average, Needs Improvement','id="levelFilter".'],
      ['Business filter','Select dropdown','No','All business types from BUSINESS_MAP','id="businessFilter".'],
      ['Results per page','Select dropdown','No','Options: 10, 25, 50','id="perPageSelect". Default: 25.'],
      ['Apply Filters button','Button','N/A','N/A','id="applyBtn". Text: "Apply Filters". Triggers fetch with all params.'],
      ['Clear Filters button','Button','N/A','N/A','id="clearBtn". Text: "Clear All". Resets all filter inputs. Re-fetches.'],
      ['Export PDF button','Button','N/A','Always enabled. Uses current filters.','id="exportPdfBtn". Text: "📄 Export PDF". Calls GET /api/admin/export/pdf with query params.'],
      ['Export CSV button','Button','N/A','Always enabled. Uses current filters.','id="exportCsvBtn". Text: "📊 Export CSV". Calls GET /api/admin/export/csv with query params.'],
    ]),
    br(),
    h3('Results Table'),
    genTable(['Column','Data','Sortable?','Notes'],[
      ['#','Row number','No','Auto from pagination'],
      ['Name','user.name','Yes','Click to open result detail modal.'],
      ['Email','user.email','Yes',''],
      ['Shared Code','user.sharedCode','Yes','Monospace font.'],
      ['Score','"X / 200"','Yes',''],
      ['%','result.percentage + "%"','Yes','Color-coded background.'],
      ['Level','result.level','Yes','Badge with level color.'],
      ['Top Category','result.highestCategory','No','Comma-separated if multiple.'],
      ['Business','result.recommendedBusiness','No','First 2 shown, rest as "+N more" tooltip.'],
      ['Date','result.createdAt','Yes','DD/MM/YYYY HH:MM format.'],
      ['Actions','Buttons','No','"View Details" button per row.'],
    ],[800,1400,1400,800,1200,1000,1400,1600,1600,1600,1560],C.primary),
    br(),
    h3('Pagination Controls'),
    fieldTable([
      ['Page info','Span','No','N/A','"Showing 26–50 of 198 results"'],
      ['Previous page','Button','N/A','Disabled on page 1','← Previous'],
      ['Page numbers','Button group','N/A','Max 5 page buttons shown','1, 2, 3, ... 8'],
      ['Next page','Button','N/A','Disabled on last page','Next →'],
    ]),
    br(),
    h3('Result Detail Modal (opened on "View Details" click)'),
    fieldTable([
      ['User info section','Readonly','N/A','N/A','Name, Email, Shared Code, Registration Date.'],
      ['Score summary','Stat grid','N/A','N/A','Total Marks, Percentage, Level badge.'],
      ['Category scores','Horizontal bar chart (mini)','N/A','N/A','All 8 categories visualised. Chart.js embedded in modal.'],
      ['Category scores table','Table','N/A','N/A','Category | Score | Percentage | Level.'],
      ['Business recommendations','Card list','N/A','N/A','All recommended business types.'],
      ['Explanation','P text','N/A','N/A','Full explanation paragraph.'],
      ['Improvement areas','Card list','N/A','N/A','Bottom 2 categories with suggestions.'],
      ['Close button','Button','N/A','N/A','"Close". Closes modal.'],
      ['Export this result PDF','Button','N/A','N/A','"Export This Result (PDF)". Calls export API with userId filter.'],
    ]),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 7: SECURITY & NFR
// ═══════════════════════════════════════════════════════════════════════════════
function part7() {
  return [
    h1('PART 7 — SECURITY, NON-FUNCTIONAL REQUIREMENTS & VALIDATION'),
    h2('7.1  Security Requirements'),
    genTable(['Requirement','Implementation','Severity'],[
      ['Password Hashing','bcryptjs with saltRounds=10. Never store plain text.','CRITICAL'],
      ['JWT Security','Sign with strong JWT_SECRET (min 64 chars). Set expiry: Admin=8h, User=2h.','CRITICAL'],
      ['Single Session','Save JWT to User/Admin.activeToken. Middleware rejects tokens not matching DB.','CRITICAL'],
      ['Marks Never Exposed','AnswerOption.marks excluded from all GET /questions responses using .select("-marks").','CRITICAL'],
      ['Admin Routes Protected','All /api/admin/* routes require requireAdminAuth middleware.','CRITICAL'],
      ['User Routes Protected','All /api/assessment/* routes require requireUserAuth middleware.','CRITICAL'],
      ['OTP Single Use','Clear otpCode + otpExpiry after successful verification.','HIGH'],
      ['OTP Expiry','OTPs expire in exactly 5 minutes. Server checks Date.now() > otpExpiry.','HIGH'],
      ['Rate Limiting','express-rate-limit: 10 requests/minute on /api/admin/login, /api/user/login, OTP endpoints.','HIGH'],
      ['Input Validation','express-validator on ALL POST and PUT endpoints. Return 400 with field-level errors.','HIGH'],
      ['Secrets in .env','MONGO_URI, JWT_SECRET, GMAIL_USER, GMAIL_PASS, PORT. .env in .gitignore.','HIGH'],
      ['CORS','Configure cors() to allow only specific origins in production.','MEDIUM'],
      ['Security Headers','helmet() middleware to set secure HTTP headers.','MEDIUM'],
      ['Error Handling','Global error handler. Never expose stack traces in production responses.','MEDIUM'],
      ['Assessment Expiry','Server-side validation: reject submissions where server time > session.expiresAt + 30s.','HIGH'],
    ],[3600,4400,1360],C.red),
    br(),

    h2('7.2  Non-Functional Requirements'),
    genTable(['NFR ID','Category','Requirement'],[
      ['NFR-01','Performance','Dashboard API response < 2 seconds. Question load < 1 second. Use MongoDB indexing on all frequently queried fields.'],
      ['NFR-02','Responsiveness','All pages functional on 320px+ (mobile) through 1920px (desktop). Use Tailwind responsive prefixes (sm:, md:, lg:).'],
      ['NFR-03','Browser Support','Chrome 90+, Firefox 90+, Safari 14+, Edge 90+. No IE support required.'],
      ['NFR-04','Availability','Application should handle MongoDB connection failures gracefully with retry logic (3 retries, exponential backoff).'],
      ['NFR-05','Concurrency','Assessment submissions are atomic operations. Use MongoDB transactions where possible to prevent race conditions.'],
      ['NFR-06','Data Integrity','A user can have at most 1 AssessmentSession and 1 Result document. Enforce via unique index on userId in Results collection.'],
      ['NFR-07','Audit Trail','Log all admin actions (create/update/delete) with adminId and timestamp. Store in a separate AdminAuditLogs collection.'],
      ['NFR-08','File Export','PDF export uses A4 landscape. CSV export includes UTF-8 BOM for Excel compatibility. Both use current filter parameters.'],
      ['NFR-09','API Versioning','All routes prefixed with /api/v1/ for future versioning capability. Current version = v1.'],
      ['NFR-10','Logging','Use morgan middleware for HTTP request logging. Log format: combined in production, dev in development.'],
    ],[1200,1800,6360],C.primary),
    br(),

    h2('7.3  Express Validator Rules — All Endpoints'),
    h3('POST /api/user/register'),
    fieldTable([
      ['codeId','ObjectId string','Yes','body("codeId").isMongoId()',''],
      ['name','String','Yes','body("name").trim().isLength({min:2,max:100}).matches(/^[a-zA-Z\\s\\-\']+$/)',''],
      ['email','Email','Yes','body("email").normalizeEmail().isEmail()',''],
      ['password','String','Yes','body("password").isLength({min:8}).matches(/^(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])/)',''],
      ['confirmPassword','String','Yes','body("confirmPassword").custom((v,{req}) => v === req.body.password)',''],
    ]),
    br(),
    h3('POST /api/admin/shared-ids (Create)'),
    fieldTable([
      ['code','String','Yes','body("code").trim().toUpperCase().isLength({min:4,max:20}).matches(/^[A-Z0-9]+$/)',''],
      ['label','String','Yes','body("label").trim().isLength({min:3,max:100})',''],
    ]),
    br(),
    h3('POST /api/assessment/submit'),
    fieldTable([
      ['sessionId','ObjectId','Yes','body("sessionId").isMongoId()',''],
      ['autoSubmitted','Boolean','No','body("autoSubmitted").optional().isBoolean()',''],
      ['answers','Array','Yes','body("answers").isArray({min:1, max:40})','Length must be 40 for manual submit'],
      ['answers[].questionId','ObjectId','Yes','body("answers.*.questionId").isMongoId()',''],
      ['answers[].answerOptionId','ObjectId','Yes','body("answers.*.answerOptionId").isMongoId()',''],
    ]),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 8: FRONTEND ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════════
function part8() {
  return [
    h1('PART 8 — FRONTEND ARCHITECTURE & JAVASCRIPT MODULES'),
    h2('8.1  assets/js/api.js — Fetch Wrapper'),
    note(
`// All API calls go through this wrapper
const API_BASE = '/api/v1';

async function apiCall(method, endpoint, body = null, requireAuth = false) {
  const headers = { 'Content-Type': 'application/json' };
  
  if (requireAuth) {
    const token = localStorage.getItem('userToken') || localStorage.getItem('adminToken');
    if (!token) { window.location.href = '/user/login.html'; return; }
    headers['Authorization'] = \`Bearer \${token}\`;
  }
  
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);
  
  const response = await fetch(API_BASE + endpoint, config);
  const data = await response.json();
  
  if (response.status === 401) {
    // Token expired or invalid session
    localStorage.clear();
    window.location.href = requireAuth ? '/user/login.html' : '/admin/login.html';
    return;
  }
  
  return { status: response.status, data };
}

// Convenience methods
const API = {
  get: (endpoint, auth) => apiCall('GET', endpoint, null, auth),
  post: (endpoint, body, auth) => apiCall('POST', endpoint, body, auth),
  put: (endpoint, body, auth) => apiCall('PUT', endpoint, body, auth),
  delete: (endpoint, auth) => apiCall('DELETE', endpoint, null, auth),
};`
    ),
    br(),

    h2('8.2  assets/js/timer.js — Assessment Timer'),
    note(
`class AssessmentTimer {
  constructor(expiresAt, onTick, onWarning, onExpire) {
    this.expiresAt = new Date(expiresAt).getTime();
    this.onTick = onTick;
    this.onWarning = onWarning;
    this.onExpire = onExpire;
    this.warningFired = false;
    this.interval = null;
  }
  
  start() {
    this.interval = setInterval(() => {
      const remaining = this.expiresAt - Date.now();
      if (remaining <= 0) {
        clearInterval(this.interval);
        this.onExpire();
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      this.onTick(mins, secs, remaining);
      if (remaining <= 300000 && !this.warningFired) {
        this.warningFired = true;
        this.onWarning();
      }
    }, 1000);
  }
  
  stop() { clearInterval(this.interval); }
}`
    ),
    br(),

    h2('8.3  assets/js/charts.js — Chart.js Helpers'),
    note(
`function renderDailyBarChart(canvasId, labels, data) {
  new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Assessments Completed', data,
        backgroundColor: '#2563EB', borderRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function renderBusinessDonutChart(canvasId, labels, data) {
  new Chart(document.getElementById(canvasId), {
    type: 'doughnut',
    data: { labels, datasets: [{ data,
      backgroundColor: ['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#BE185D','#78350F'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderCategoryBarChart(canvasId, categoryScores) {
  const labels = Object.keys(categoryScores);
  const data = Object.values(categoryScores);
  new Chart(document.getElementById(canvasId), {
    type: 'bar',
    indexAxis: 'y',
    data: { labels, datasets: [{ data, backgroundColor: '#2563EB', borderRadius: 4 }] },
    options: { responsive: true, scales: { x: { max: 25 } } }
  });
}`
    ),
    br(),

    h2('8.4  Auth Guard Pattern (All Protected Pages)'),
    note(
`// Add at the TOP of every protected page's <script> block (before any DOM manipulation)

(function authGuard() {
  const token = localStorage.getItem('userToken'); // or 'adminToken' for admin pages
  if (!token) {
    window.location.replace('/user/login.html'); // use replace() to prevent back navigation
    throw new Error('Redirect'); // halt further script execution
  }
  // Optionally decode JWT to check expiry client-side
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.clear();
      window.location.replace('/user/login.html');
      throw new Error('Token expired');
    }
  } catch(e) { /* invalid token */ }
})();`
    ),
    br(),

    h2('8.5  Error Handling Pattern — All API Calls'),
    note(
`async function safeApiCall(fn, onSuccess, onError) {
  try {
    showLoader();
    const result = await fn();
    if (result.data.success) {
      onSuccess(result.data);
    } else {
      onError(result.data.message || 'An error occurred.', result.data.errors);
    }
  } catch (err) {
    onError('Network error. Please check your connection.');
  } finally {
    hideLoader();
  }
}`
    ),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 9: EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function part9() {
  return [
    h1('PART 9 — EXPORT & UTILITY SPECIFICATIONS'),
    h2('9.1  PDF Export Specification (pdfkit)'),
    body('File: backend/utils/exportHelper.js — generatePDF(results, filters) function'),
    br(),
    genTable(['Section','Content','Styling'],[
      ['Cover/Header','App name, "Assessment Results Report", date range, generated timestamp, admin email','Dark blue background, white text, full width'],
      ['Filter Summary','Applied filters (date range, level, business) or "All Results"','Gray box, 12pt'],
      ['Summary Stats','Total results, average score, highest, lowest','2-col layout'],
      ['Results Table Header','#, Name, Email, Code, Score, %, Level, Top Category, Business, Date','Dark header row, bold white text'],
      ['Results Table Rows','One row per result. Alternating row colors.','10pt font. Color-coded level column.'],
      ['Footer','Page X of Y, generated by app name','Gray, bottom of each page'],
    ],[2000,4000,3360],C.primary),
    br(),
    note(
`// generatePDF core logic outline
const PDFDocument = require('pdfkit');
function generatePDF(results, filters = {}) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
  // Page 1: Header + stats
  // Page 2+: Results table (paginate every 25 rows)
  // Each page: footer with page numbers
  // Return doc (pipe to response stream in controller)
  return doc;
}`
    ),
    br(),

    h2('9.2  CSV Export Specification (json2csv)'),
    body('File: backend/utils/exportHelper.js — generateCSV(results) function'),
    br(),
    genTable(['CSV Column Header','Data Field','Notes'],[
      ['Name','user.name',''],
      ['Email','user.email',''],
      ['Shared Code','user.sharedCode',''],
      ['Total Marks','result.totalMarks','Integer'],
      ['Percentage','result.percentage','Float with 1 decimal'],
      ['Level','result.level','Text string'],
      ['Communication Score','result.categoryScores.Communication','Integer 5–25'],
      ['Creativity Score','result.categoryScores.Creativity','Integer 5–25'],
      ['Problem Solving Score','result.categoryScores["Problem Solving"]','Integer 5–25'],
      ['Leadership Score','result.categoryScores.Leadership','Integer 5–25'],
      ['Risk Taking Score','result.categoryScores["Risk Taking"]','Integer 5–25'],
      ['Financial Awareness Score','result.categoryScores["Financial Awareness"]','Integer 5–25'],
      ['Business Mindset Score','result.categoryScores["Business Mindset"]','Integer 5–25'],
      ['Teamwork Score','result.categoryScores.Teamwork','Integer 5–25'],
      ['Top Category','result.highestCategory.join("; ")','Semicolon-separated if multiple'],
      ['Recommended Business','result.recommendedBusiness.join("; ")','Semicolon-separated'],
      ['Assessment Date','result.createdAt','ISO 8601 format'],
    ],[2600,3200,3560],C.accent),
    br(),

    h2('9.3  Email Sender (Nodemailer)'),
    note(
`// backend/utils/emailSender.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS  // Gmail App Password (not account password)
  }
});

async function sendOTPEmail(toEmail, toName, otp, type = 'user') {
  const subject = type === 'admin' 
    ? 'Admin Login OTP — Psychometric Assessment' 
    : 'Verify Your Email — Psychometric Assessment';
    
  const html = \`
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
      <div style="background:#1B3A6B;padding:20px;text-align:center;">
        <h1 style="color:white;margin:0;">Psychometric Assessment</h1>
      </div>
      <div style="padding:30px;">
        <p>Hello \${toName || ''},</p>
        <p>Your verification OTP is:</p>
        <div style="text-align:center;padding:20px;background:#F0F4FF;border-radius:8px;margin:20px 0;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#1B3A6B;">\${otp}</span>
        </div>
        <p style="color:#666;">This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
      </div>
    </div>
  \`;
  
  await transporter.sendMail({
    from: \`"Psychometric Assessment" <\${process.env.GMAIL_USER}>\`,
    to: toEmail,
    subject,
    html
  });
}`
    ),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 10: SEED DATA
// ═══════════════════════════════════════════════════════════════════════════════
function part10() {
  return [
    h1('PART 10 — DATABASE SEED DATA'),
    note('Create a backend/scripts/seed.js file that populates all required data. Run with: node backend/scripts/seed.js. This must be idempotent (safe to run multiple times).'),
    br(),

    h2('10.1  Admin Seed'),
    note(
`// Create one admin
await Admin.findOneAndUpdate(
  { email: process.env.ADMIN_EMAIL },
  {
    email: process.env.ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
  },
  { upsert: true, new: true }
);
// Add ADMIN_EMAIL and ADMIN_PASSWORD to .env`
    ),
    br(),

    h2('10.2  Question Types Seed'),
    genTable(['Order','Name','Description','Icon','Color'],[
      ['1','Communication','Measures ability to express ideas clearly, listen actively, and engage persuasively.','💬','#2563EB'],
      ['2','Creativity','Measures ability to generate innovative ideas and think outside conventional boundaries.','🎨','#7C3AED'],
      ['3','Problem Solving','Measures analytical thinking, logical reasoning, and structured approach to challenges.','🧩','#16A34A'],
      ['4','Leadership','Measures ability to inspire, motivate, guide, and make decisions for a team.','🦅','#D97706'],
      ['5','Risk Taking','Measures comfort with uncertainty, boldness in decision-making, and entrepreneurial appetite.','🎯','#DC2626'],
      ['6','Financial Awareness','Measures understanding of money management, budgeting, financial planning, and profitability.','💰','#0891B2'],
      ['7','Business Mindset','Measures customer-centric thinking, market awareness, and strategic business orientation.','📈','#BE185D'],
      ['8','Teamwork','Measures ability to collaborate, share responsibilities, and achieve collective goals.','🤝','#78350F'],
    ],[600,2000,4000,800,1960],C.primary),
    br(),

    h2('10.3  Sample Questions Seed (3 per Category Shown — Total 40 Required)'),
    body('Each category needs exactly 5 questions. Below are sample questions. Complete all 40 for production.'),
    br(),
    genTable(['Category','Sample Question'],[
      ['Communication','I am comfortable speaking in front of large groups of people.'],
      ['Communication','I can clearly explain complex ideas to someone who has no prior knowledge of the topic.'],
      ['Communication','I prefer to communicate problems and solutions in writing rather than verbally.'],
      ['Creativity','I enjoy brainstorming new and unconventional solutions to everyday problems.'],
      ['Creativity','I regularly come up with unique ideas that others around me have not considered.'],
      ['Creativity','I find it easy to reimagine how existing products or services could be improved.'],
      ['Problem Solving','When I face a difficult problem, I break it into smaller parts before finding a solution.'],
      ['Problem Solving','I remain calm and focused under pressure and am able to make rational decisions quickly.'],
      ['Problem Solving','I prefer to identify the root cause of a problem rather than just treating symptoms.'],
      ['Leadership','People often look to me for direction or guidance in group settings.'],
      ['Leadership','I am comfortable making decisions on behalf of a team, even without full consensus.'],
      ['Leadership','I take ownership of both the successes and failures of teams I lead.'],
      ['Risk Taking','I am willing to invest time and money into an idea even without guaranteed success.'],
      ['Risk Taking','I see failure as a valuable learning experience rather than something to be feared.'],
      ['Risk Taking','I would leave a stable job to pursue a business opportunity I believe in strongly.'],
      ['Financial Awareness','I understand the difference between revenue, profit, and cash flow.'],
      ['Financial Awareness','I regularly track my personal spending and maintain a monthly budget.'],
      ['Financial Awareness','I can read and interpret a basic profit and loss statement.'],
      ['Business Mindset','I constantly think about how I could improve products or services I use daily.'],
      ['Business Mindset','I am aware of current market trends in industries that interest me.'],
      ['Business Mindset','I think about customers\' needs and pain points before designing solutions.'],
      ['Teamwork','I actively contribute to team efforts and enjoy working collaboratively.'],
      ['Teamwork','I am comfortable delegating tasks to others and trusting them to deliver.'],
      ['Teamwork','I adapt my communication style to work effectively with different types of people.'],
    ],[2400,6960],C.green),
    br(),

    h2('10.4  Answer Options Seed (Applied to Every Question)'),
    genTable(['Order','Label','Marks (Server-side Only)'],[
      ['1','Strongly Agree','5'],
      ['2','Agree','4'],
      ['3','Neutral','3'],
      ['4','Disagree','2'],
      ['5','Strongly Disagree','1'],
    ],[1000,4680,3680],C.purple),
    br(),

    h2('10.5  Sample Shared User IDs'),
    genTable(['Code','Label','isActive'],[
      ['DEMO2025','Demo Batch 2025','true'],
      ['BATCH01A','Batch 01 — Section A','true'],
      ['TEST001','Testing Code — Admin Use','true'],
    ],[2000,5000,2360],C.accent),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 11: ENVIRONMENT & DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════════
function part11() {
  return [
    h1('PART 11 — ENVIRONMENT CONFIGURATION & DEPLOYMENT'),
    h2('11.1  .env File (Complete)'),
    note(
`# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/psychometric_assessment?retryWrites=true&w=majority

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-64-characters-long-use-random-generator

# Email (Gmail SMTP)
GMAIL_USER=your.email@gmail.com
GMAIL_PASS=xxxx xxxx xxxx xxxx   # Gmail App Password (16 chars with spaces)

# Admin Seed
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=SecureAdminPassword123!

# Frontend URLs (for CORS)
USER_APP_URL=http://localhost:3000
ADMIN_APP_URL=http://localhost:3001`
    ),
    br(),

    h2('11.2  server.js Structure'),
    note(
`const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const connectDB = require('./config/db');
connectDB();

// Middleware
app.use(helmet());
app.use(cors({ origin: [process.env.USER_APP_URL, process.env.ADMIN_APP_URL] }));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting on auth routes
const authLimiter = rateLimit({ windowMs: 60000, max: 10, message: 'Too many requests' });
app.use('/api/v1/admin/login', authLimiter);
app.use('/api/v1/user/login', authLimiter);
app.use('/api/v1/user/verify-otp', authLimiter);

// Routes
app.use('/api/v1/admin', require('./routes/adminAuth'));
app.use('/api/v1/admin', require('./routes/adminCRUD'));
app.use('/api/v1/admin', require('./routes/adminDashboard'));
app.use('/api/v1/user', require('./routes/userAuth'));
app.use('/api/v1/assessment', require('./routes/assessment'));

// Global error handler
app.use(require('./middleware/errorHandler'));

app.listen(process.env.PORT, () => console.log(\`Server running on port \${process.env.PORT}\`));`
    ),
    br(),

    h2('11.3  package.json Dependencies'),
    note(
`{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "express-rate-limit": "^6.7.0",
    "express-validator": "^7.0.1",
    "helmet": "^7.0.0",
    "json2csv": "^6.0.0-alpha.2",
    "jsonwebtoken": "^9.0.0",
    "mongoose": "^7.3.1",
    "morgan": "^1.10.0",
    "nodemailer": "^6.9.3",
    "pdfkit": "^0.13.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "scripts": {
    "start": "node backend/server.js",
    "dev": "nodemon backend/server.js",
    "seed": "node backend/scripts/seed.js"
  }
}`
    ),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 12: AI BUILD PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════
function part12() {
  return [
    h1('PART 12 — AI CODING ASSISTANT BUILD GUIDE'),
    note('Use these prompts in sequence with Claude Code, Cursor, or GitHub Copilot. Attach this full PDF document with each prompt. Each prompt is self-contained and builds on the previous.'),
    br(),

    h2('PROMPT SEQUENCE'),
    genTable(['Prompt #','Title','Attach This Spec?','Time Est.'],[
      ['P-01','Project scaffold + dependencies + .env + server.js + db.js','Yes — Full PDF','30 min'],
      ['P-02','All 9 Mongoose models from Part 2 with exact field types and constraints','Yes','30 min'],
      ['P-03','Admin auth: login, OTP, logout, requireAdminAuth middleware','Yes','45 min'],
      ['P-04','Admin CRUD routes and controllers: SharedUserIDs, QuestionTypes, Questions, AnswerOptions','Yes','60 min'],
      ['P-05','Admin dashboard + results APIs: GET /dashboard, GET /results (paginated), exports','Yes','60 min'],
      ['P-06','User auth: validate-code, register, verify-otp, login, resend-otp, requireUserAuth middleware','Yes','60 min'],
      ['P-07','Assessment engine: GET /questions (no marks), POST /start, POST /submit, GET /result + scoreCalculator.js','Yes','90 min'],
      ['P-08','User frontend: index.html, register.html, otp-register.html, login.html (Tailwind + api.js)','Yes','90 min'],
      ['P-09','User frontend: welcome.html, assessment.html (timer, sidebar, navigation), result.html','Yes','120 min'],
      ['P-10','Admin frontend: login.html, otp.html, dashboard.html (Chart.js KPI cards + charts)','Yes','90 min'],
      ['P-11','Admin frontend: shared-ids.html, question-types.html, questions.html, answer-options.html','Yes','90 min'],
      ['P-12','Admin frontend: results.html (search, filters, pagination, modals, export buttons)','Yes','60 min'],
      ['P-13','Seed script: admin, 8 question types, 40 questions, answer options, sample shared IDs','Yes','30 min'],
      ['P-14','Security hardening: rate limiting, helmet, validation middleware audit, error handler','Yes','45 min'],
    ],[800,3200,2000,1560],C.primary),
    br(),

    h2('PROMPT TEMPLATES'),
    h3('P-01: Project Scaffold'),
    note(
`Using the attached full specification PDF, build the complete Node.js + Express.js project scaffold.
Specifically:
1. Create the exact folder structure from Section 4 (Part 1.5)
2. Install all packages from Part 11.3 package.json
3. Create .env with all placeholder values from Part 11.1
4. Create backend/server.js exactly as specified in Part 11.2
5. Create backend/config/db.js with Mongoose connection, retry logic (3 retries, exponential backoff), and connection event logging
6. Create .gitignore (include .env, node_modules, *.log)
Do NOT create models or routes yet.`
    ),
    br(),

    h3('P-07: Assessment Engine (Most Complex)'),
    note(
`Using the attached full specification PDF, build the complete assessment engine.

Build these files:
1. backend/routes/assessment.js (route definitions only)
2. backend/controllers/assessmentController.js (all logic)
3. backend/utils/scoreCalculator.js (complete scoring algorithm from Part 4)

Implement these endpoints exactly as specified in Part 3.8:
- GET /api/v1/assessment/questions — CRITICAL: marks field must NEVER appear in response (use .select("-marks"))
- POST /api/v1/assessment/start — validate user hasn't completed/in-progress
- POST /api/v1/assessment/submit — full validation, score calculation, Result save
- GET /api/v1/assessment/result — return complete result for user

In scoreCalculator.js, implement:
- Category score calculation per Part 4.1
- Level assignment per Part 4.2 thresholds
- BUSINESS_MAP from Part 4.3
- Improvement areas from Part 4.4
- Handle tied top categories (multiple recommendations)`
    ),
    br(),

    h3('P-09: Assessment Page (Most Complex Frontend)'),
    note(
`Using the attached full specification PDF, build user/assessment.html and user/welcome.html.

assessment.html must include all of the following from Part 5.6:
- Left sidebar (250px) with 8 category progress items, active highlighting, completion checkmarks
- Top bar: question counter, category label, timer display with red warning state
- Main content: category banner, question text, 5 full-width clickable radio cards, Previous/Next/Submit buttons
- Answer state management using draftAnswers object + sessionStorage backup
- Complete timer using AssessmentTimer class from api.js
- 5-minute warning popup/toast
- Auto-submit when timer expires
- Manual submit confirmation modal on Q40
- Full loading overlay "Calculating your results..." during submission
- Mobile responsive: sidebar collapses to horizontal strip on mobile

Do NOT show answer marks anywhere in the UI. Options only show label text.
Restore previous answers on page load from sessionStorage draftAnswers.`
    ),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 13: ACCEPTANCE TEST CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════════
function part13() {
  return [
    h1('PART 13 — ACCEPTANCE TEST CHECKLIST'),
    note('Use this checklist for QA before every release. Each item must be manually tested and signed off.'),
    br(),

    h2('13.1  Auth & Access Control'),
    genTable(['Test ID','Test Case','Expected Result','Pass/Fail'],[
      ['AC-01','Admin accesses /dashboard without token','Redirect to /admin/login.html',''],
      ['AC-02','User accesses /assessment.html without token','Redirect to /user/login.html',''],
      ['AC-03','Admin logs in with wrong password','Error: "Invalid credentials". No OTP sent.',''],
      ['AC-04','Admin logs in with correct credentials','OTP sent email. Redirect to OTP page.',''],
      ['AC-05','Admin enters wrong OTP 3x','Error shown. OTP not cleared (stays expired).',''],
      ['AC-06','Admin enters expired OTP (>5 min)','Error: "OTP has expired. Please login again."',''],
      ['AC-07','Admin logs in on second browser after first login','First browser receives 401 on next API call. Redirected to login.',''],
      ['AC-08','User enters invalid Shared User ID','Error: "Invalid access code."',''],
      ['AC-09','User enters deactivated Shared User ID','Error: "Access code deactivated."',''],
      ['AC-10','User registers with duplicate email','Error: "Email already registered."',''],
      ['AC-11','User registers with weak password (no uppercase)','Field-level error shown. Form not submitted.',''],
      ['AC-12','User verifies OTP successfully','JWT stored in localStorage. Redirected to welcome.html.',''],
      ['AC-13','User logs in on second device','First device receives 401. Redirected to login.',''],
    ],[1200,3000,3000,1160],C.primary),
    br(),

    h2('13.2  Assessment Engine'),
    genTable(['Test ID','Test Case','Expected Result','Pass/Fail'],[
      ['AE-01','GET /assessment/questions response contains marks field','FAIL — marks must be absent',''],
      ['AE-02','User clicks Start Assessment','Session created. Timer starts from 30:00.',''],
      ['AE-03','User answers Q1 and clicks Next','Q2 displayed. Q1 answer preserved in draftAnswers.',''],
      ['AE-04','User clicks Previous on Q3','Q2 displayed. Q3 answer preserved.',''],
      ['AE-05','User on Q39 tries to click Next without answering','Next button remains disabled.',''],
      ['AE-06','Timer reaches 5:00 remaining','Warning popup appears. Timer text turns red.',''],
      ['AE-07','Timer reaches 0:00','Auto-submit triggered with all answered questions.',''],
      ['AE-08','User answers all 40 and clicks Submit','Confirmation modal appears.',''],
      ['AE-09','User submits all 40 answers','Result calculated and saved. Redirected to result.html.',''],
      ['AE-10','User submits partial answers via auto-submit','Partial result calculated with only answered questions\' marks.',''],
      ['AE-11','User tries to start second assessment after completing','403 error. Redirected to result.html.',''],
      ['AE-12','Check total marks for all-Strongly-Agree answers','200 / 200 (40 × 5)',''],
      ['AE-13','Check total marks for all-Strongly-Disagree answers','40 / 200 (40 × 1)',''],
      ['AE-14','2 categories tied for highest score','Both categories\' business types shown in result.',''],
    ],[1200,3000,3000,1160],C.green),
    br(),

    h2('13.3  Admin CRUD'),
    genTable(['Test ID','Test Case','Expected Result','Pass/Fail'],[
      ['CR-01','Admin creates new Shared User ID','Appears immediately in list. usageCount = 0.',''],
      ['CR-02','Admin creates duplicate Shared User ID code','Error: code already exists.',''],
      ['CR-03','Admin deactivates Shared User ID','isActive = false. Existing users unaffected. New users get 403.',''],
      ['CR-04','Admin adds 6th question to a category','Error: "Category already has 5 active questions."',''],
      ['CR-05','Admin deactivates a question with active sessions','Warning shown. Question deactivated. Past sessions unaffected.',''],
      ['CR-06','Admin sets AnswerOption marks to 6','Validation error: marks must be 1–5.',''],
      ['CR-07','Admin creates question without selecting category','Validation error: category required.',''],
    ],[1200,3000,3000,1160],C.gold),
    br(),

    h2('13.4  Result & Export'),
    genTable(['Test ID','Test Case','Expected Result','Pass/Fail'],[
      ['RE-01','User result page has PDF export button','FAIL — no export button allowed on user result page',''],
      ['RE-02','Admin exports PDF','File downloads. Filename: psychometric_results_YYYYMMDD.pdf',''],
      ['RE-03','Admin exports CSV','File downloads. All 18 columns present. UTF-8 BOM included.',''],
      ['RE-04','Admin searches by name "John"','Only results from users named John appear.',''],
      ['RE-05','Admin filters by level "Excellent"','Only results with level=Excellent shown.',''],
      ['RE-06','Admin filters by date range','Only results within range shown.',''],
      ['RE-07','Admin exports CSV with active filters','CSV contains only filtered results.',''],
      ['RE-08','Result page shows correct category bar chart','8 bars, correct scores, max bar = 25.',''],
    ],[1200,3000,3000,1160],C.red),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 14: WORKFLOW DIAGRAMS (text-based)
// ═══════════════════════════════════════════════════════════════════════════════
function part14() {
  return [
    h1('PART 14 — COMPLETE WORKFLOW DIAGRAMS'),
    h2('14.1  User Registration & Auth Flow'),
    note(
`[index.html]
    │ User enters Shared User ID
    │ Click "Continue"
    ▼
POST /api/v1/user/validate-code
    │ 200 OK → save codeId, code to sessionStorage
    │ 404/403 → show error on page
    ▼
[register.html]
    │ User fills: name, email, password, confirmPassword
    │ Real-time validation (strength meter, match indicator)
    │ Click "Create Account & Send OTP"
    ▼
POST /api/v1/user/register
    │ 201 Created → save pendingEmail to sessionStorage → [otp-register.html]
    │ 409 Conflict → show "Email exists" error
    │ 400 → show field-level errors
    ▼
[otp-register.html]
    │ User enters 6-digit OTP
    │ Click "Verify Email"
    ▼
POST /api/v1/user/verify-otp
    │ 200 OK → save JWT to localStorage → clear sessionStorage → [welcome.html]
    │ 400 → show OTP error, clear inputs
    ▼
[welcome.html]
    │ User reads instructions
    │ Click "Start Assessment"
    ▼
POST /api/v1/assessment/start
    │ 201 Created → save sessionId, expiresAt → [assessment.html]
    │ 403 → already completed → [result.html]
    ▼
[assessment.html]
    │ Load 40 questions, start timer, render Q1
    │ User navigates through all 40 questions
    │ Timer auto-submit OR manual submit on Q40
    ▼
POST /api/v1/assessment/submit
    │ 200 OK → clear session storage → [result.html]
    ▼
GET /api/v1/assessment/result
    │ 200 OK → render full personalised result
    ▼
[result.html] ← FINAL DESTINATION`
    ),
    br(),

    h2('14.2  Admin Flow'),
    note(
`[admin/login.html]
    │ Admin enters email + password
    │ Click "Login & Send OTP"
    ▼
POST /api/v1/admin/login
    │ 200 OK → OTP sent → save adminPendingEmail → [admin/otp.html]
    │ 401 → show error
    ▼
[admin/otp.html]
    │ Admin enters 6-digit OTP
    │ Click "Verify & Access Dashboard"
    ▼
POST /api/v1/admin/verify-otp
    │ 200 OK → save adminToken to localStorage → [admin/dashboard.html]
    │ 400 → show error
    ▼
[admin/dashboard.html]
    │ GET /api/v1/admin/dashboard
    │ Renders: KPI cards, bar chart, doughnut chart, recent results table
    │
    ├── Sidebar: "Shared User IDs" → [admin/shared-ids.html]
    │       GET /api/v1/admin/shared-ids
    │       CRUD via modals
    │
    ├── Sidebar: "Question Types" → [admin/question-types.html]
    │       GET/POST/PUT /api/v1/admin/question-types
    │
    ├── Sidebar: "Questions" → [admin/questions.html]
    │       GET/POST/PUT /api/v1/admin/questions?typeId=
    │
    ├── Sidebar: "Answer Options" → [admin/answer-options.html]
    │       GET/POST/PUT /api/v1/admin/answer-options?questionId=
    │
    └── Sidebar: "Results" → [admin/results.html]
            GET /api/v1/admin/results?search=&level=&dateFrom=&dateTo=&page=
            GET /api/v1/admin/export/pdf (with filters)
            GET /api/v1/admin/export/csv (with filters)`
    ),
    br(),

    h2('14.3  Score Calculation Flow'),
    note(
`POST /api/v1/assessment/submit received
    │
    ├─ [Validation Layer]
    │   ├── answers.length === 40 (or accept partial if autoSubmitted)
    │   ├── sessionId belongs to req.user._id
    │   ├── session.status === "in-progress"
    │   ├── Date.now() <= session.expiresAt + 30000 (30s buffer)
    │   └── Each answerOptionId belongs to its questionId
    │
    ├─ [Save UserAnswers]
    │   └── Bulk insert 40 UserAnswer documents with denormalised marks
    │
    ├─ [scoreCalculator.calculateResult()]
    │   ├── Group answers by QuestionType.name
    │   ├── Sum marks per category (max 25 each)
    │   ├── totalMarks = sum of all 8 category scores
    │   ├── percentage = (totalMarks / 200) × 100
    │   ├── level = lookup from thresholds table
    │   ├── maxScore = Math.max(...categoryScores values)
    │   ├── highestCategory = all categories where score === maxScore
    │   ├── recommendedBusiness = union of BUSINESS_MAP[highestCategory]
    │   └── improvementAreas = bottom 2 categories + suggestion template
    │
    ├─ [Save Result document]
    │
    ├─ [Update AssessmentSession: status="submitted", submittedAt=now]
    │
    ├─ [Update User: hasCompletedAssessment=true]
    │
    └─ [Return { success: true, resultId }]`
    ),
    pageBreak()
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 15: DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
function part15() {
  return [
    h1('PART 15 — DESIGN SYSTEM & UI STANDARDS'),
    h2('15.1  Color Palette'),
    genTable(['Token','Hex Value','Usage'],[
      ['primary','#1B3A6B','Page backgrounds (sidebars, headers), primary text headers'],
      ['accent','#2563EB','Buttons (primary), links, active states, borders'],
      ['accent-light','#DBEAFE','Info boxes, card backgrounds, hover states'],
      ['success','#16A34A','Success states, active badges, positive results'],
      ['success-light','#DCFCE7','Success backgrounds, "Active" badge bg'],
      ['warning','#D97706','Warning states, timer warning color'],
      ['warning-light','#FEF3C7','Warning box backgrounds'],
      ['danger','#DC2626','Error states, inactive badges, critical alerts'],
      ['danger-light','#FEE2E2','Error backgrounds, inline error messages'],
      ['gray-50','#F8FAFC','Page background, alternating table rows'],
      ['gray-200','#E2E8F0','Borders, dividers, input borders'],
      ['gray-400','#94A3B8','Placeholder text, disabled states'],
      ['gray-700','#334155','Body text, table cell content'],
      ['gray-900','#0F172A','Headings, high-emphasis text'],
    ],[2000,2000,5360],C.primary),
    br(),

    h2('15.2  Typography'),
    genTable(['Element','Font','Size (Tailwind)','Weight','Color'],[
      ['Page Title (H1)','Inter / DM Sans','text-3xl (30px)','font-bold','gray-900'],
      ['Section Heading (H2)','Inter / DM Sans','text-2xl (24px)','font-semibold','primary'],
      ['Sub-heading (H3)','Inter / DM Sans','text-xl (20px)','font-semibold','gray-800'],
      ['Card Title (H4)','Inter / DM Sans','text-lg (18px)','font-medium','gray-700'],
      ['Body Text','Inter / DM Sans','text-base (16px)','font-normal','gray-700'],
      ['Small Text','Inter / DM Sans','text-sm (14px)','font-normal','gray-500'],
      ['Caption','Inter / DM Sans','text-xs (12px)','font-normal','gray-400'],
      ['Button Text (primary)','Inter / DM Sans','text-base (16px)','font-semibold','white'],
      ['Input Text','Inter / DM Sans','text-base (16px)','font-normal','gray-900'],
      ['Code / Monospace','JetBrains Mono','text-sm (14px)','font-normal','gray-800'],
    ],[2000,2000,2000,1600,1760],C.primary),
    br(),

    h2('15.3  Component Standards'),
    h3('Primary Button'),
    note('class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"'),
    br(),
    h3('Secondary Button'),
    note('class="bg-white hover:bg-gray-50 text-gray-700 font-semibold text-base py-3 px-6 rounded-lg border border-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"'),
    br(),
    h3('Input Field'),
    note('class="w-full px-4 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 transition-colors"'),
    br(),
    h3('Error State Input'),
    note('Add: border-red-500 focus:ring-red-500 (replace gray-300 and blue-500)'),
    br(),
    h3('Assessment Answer Option Card (Selected State)'),
    note(
`// Default state:
class="flex items-center p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all mb-3"

// Selected state (add via JS):
class="... border-blue-600 bg-blue-50 shadow-sm"

// Radio input: hidden inside card. Card click triggers radio selection.`
    ),
    br(),

    h2('15.4  Responsive Breakpoints (Tailwind)'),
    genTable(['Breakpoint','Min Width','Usage'],[
      ['(default)','0px','Mobile: single column, stacked layout'],
      ['sm:','640px','Small tablets: 2-col for some cards'],
      ['md:','768px','Tablets: sidebar appears, 3-col cards'],
      ['lg:','1024px','Desktop: full sidebar, charts side-by-side'],
      ['xl:','1280px','Wide desktop: wider tables, more data density'],
    ],[2000,2000,5360],C.primary),
    br(),

    h2('15.5  Loading & Empty States'),
    genTable(['State','UI Pattern','Example Text'],[
      ['API Loading (page)','Full-page centered spinner (Tailwind animate-spin)','Loading...'],
      ['API Loading (button)','Replace button text with inline spinner','Processing...'],
      ['Empty table','Centered illustration + message + CTA button','No results found. Try adjusting your filters.'],
      ['Empty OTP','Grey input boxes (focus first on mount)','Enter the 6-digit code sent to your email.'],
      ['Error state','Red alert box at top of card','Something went wrong. Please try again.'],
      ['Success state','Green toast notification (auto-dismiss 3s)','Saved successfully!'],
    ],[2000,3000,4360],C.accent),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BUILD
// ═══════════════════════════════════════════════════════════════════════════════
async function build() {
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22, color: C.gray5 } }
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial', color: C.primary },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: C.accent },
          paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: C.primary },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: C.gray5 },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 3 } },
      ]
    },
    numbering: {
      config: [
        { reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 360 }, spacing: { before: 40, after: 40 } } } }] },
        { reference: 'subbullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 900, hanging: 360 }, spacing: { before: 30, after: 30 } } } }] },
        { reference: 'numbers',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 360 }, spacing: { before: 40, after: 40 } } } }] },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.gray2, space: 6 } },
            children: [
              new TextRun({ text: 'Psychometric Assessment Platform — Enterprise Specification Kit v2.0', font: 'Arial', size: 18, color: C.gray3 }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: C.gray3 }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
            spacing: { before: 0, after: 120 }
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.gray2, space: 6 } },
            children: [
              new TextRun({ text: 'CONFIDENTIAL — For development use only. Do not distribute.', font: 'Arial', size: 16, color: C.gray3 }),
            ],
            spacing: { before: 120, after: 0 }
          })]
        })
      },
      children: [
        ...coverPage(),
        ...part1(),
        ...part2(),
        ...part3(),
        ...part4(),
        ...part5(),
        ...part6(),
        ...part7(),
        ...part8(),
        ...part9(),
        ...part10(),
        ...part11(),
        ...part12(),
        ...part13(),
        ...part14(),
        ...part15(),
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('./Psychometric_Assessment_Platform_Spec_v2.docx', buffer);
  console.log('✅ Document written successfully');
  console.log('Size:', (buffer.length / 1024).toFixed(0) + ' KB');
}

build().catch(console.error);
