\# SotorkoBangladesh



SE 331 Software Engineering Design Capstone Project — Road Accident Risk \& News Analytics Platform.



\## Team

\- Mazeda Khatun Ratna (232-35-639)

\- Ummy Sawda (241-35-520)



\## Features Implemented (Phase 1)

\- \*\*FR-01\*\*: Guest public district-level risk map

\- \*\*FR-02\*\*: User registration with preferred district

\- \*\*FR-03\*\*: Password hashing with bcrypt, unique email enforcement

\- \*\*FR-04\*\*: Login with JWT access token



\## Tech Stack

\- Frontend: React + Vite, Leaflet

\- Backend: FastAPI, SQLAlchemy, bcrypt, python-jose

\- Database: SQLite



\## How to Run



\### Backend

```bash

cd backend

python -m venv venv

venv\\Scripts\\Activate.ps1

pip install -r requirements.txt

uvicorn main:app --reload

