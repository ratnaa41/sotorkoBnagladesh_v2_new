\# Test Results — Phase 1 (FR-01 to FR-04)



\## Backend (Swagger at http://127.0.0.1:8000/docs)



| # | Test | Endpoint | Result |

|---|---|---|---|

| 1 | Server alive | GET / | 200 |

| 2 | Register new user | POST /api/auth/register | 201 |

| 3 | Duplicate email | POST /api/auth/register | 400 "Email already registered" |

| 4 | Login with correct password | POST /api/auth/login | 200 + JWT |

| 5 | Protected /me with token | GET /api/auth/me | 200 |

| 6 | Protected /me without token | GET /api/auth/me | 403 |

| 7 | Public summary no auth | GET /api/public/summary | 200 |



\## Frontend (Browser at http://localhost:5173)



| # | Test | Result |

|---|---|---|

| 1 | Guest sees district map | Pass |

| 2 | Dhaka popup shows risk | Pass |

| 3 | Register with new email redirects to map | Pass |

| 4 | Duplicate email shows error | Pass |

| 5 | Login with correct credentials | Pass |

| 6 | Wrong password rejected | Pass |

| 7 | Token stored in localStorage | Pass |



\## Coverage

\- FR-01 ✅

\- FR-02 ✅

\- FR-03 ✅

\- FR-04 ✅

