# Frontend-Backend Integration Guide

## Setup Instructions

### 1. Install Dependencies

```bash
cd movie-app
npm install @react-native-async-storage/async-storage
```

### 2. Configure API URL

Edit `movie-app/services/config.ts`:

- **For Emulator/Simulator**: Use `http://localhost:8000/api/v1`
- **For Physical Device**: Use your computer's IP address, e.g., `http://192.168.1.100:8000/api/v1`

To find your IP:
- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr`

### 3. Start Backend Server

```bash
cd backend
python run.py
# Or: uvicorn app.main:app --reload
```

The backend should be running on `http://localhost:8000`

### 4. Start Frontend

```bash
cd movie-app
npm start
```

## API Integration Status

### ✅ Completed

1. **Authentication**
   - Login (`/api/v1/auth/login`)
   - Signup (`/api/v1/auth/signup`)
   - Token stored in AsyncStorage
   - Auto-included in API requests

2. **Patients**
   - Create patient (`POST /api/v1/patients`)
   - List patients (`GET /api/v1/patients`)
   - Get patient details (`GET /api/v1/patients/{patient_id}`)
   - Update patient (`PUT /api/v1/patients/{patient_id}`)

### 🔄 To Be Integrated

- Appointments
- Medications
- Reports
- Doctors
- Risk Prediction
- Compatibility Check

## Testing the Integration

### 1. Create a User Account

1. Open the app
2. Go to Sign Up
3. Create an account (default role: patient)
4. You'll be automatically logged in

### 2. Create a Patient

1. Navigate to Patients screen
2. Click "+ Add Patient"
3. Fill in the form:
   - Patient ID (required)
   - Age (required)
   - Gender (required)
   - Lab tests (optional)
   - Vital signs (optional)
   - Conditions (optional)
4. Click "Save Patient"
5. Patient will be saved to MongoDB

### 3. View Patients

1. Go to Patients list
2. You should see all patients from the database
3. Pull down to refresh
4. Search by patient ID

### 4. Verify in MongoDB Compass

1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Select `healthsage` database
4. You should see:
   - `users` collection (after signup)
   - `patients` collection (after creating patients)

## Troubleshooting

### "Network request failed"

- **Emulator**: Make sure backend is running and use `http://10.0.2.2:8000` for Android emulator
- **Physical Device**: Use your computer's IP address, not localhost
- **iOS Simulator**: `localhost` should work

### "401 Unauthorized"

- Make sure you're logged in
- Token might have expired, try logging in again
- Check if token is being sent in Authorization header

### Collections Not Showing in MongoDB Compass

- Collections only appear after data is inserted
- Create a user and patient first
- Run `python backend/test_connection.py` to verify connection

### CORS Errors

- Backend CORS is configured for Expo development
- If issues persist, check `backend/app/core/config.py` CORS_ORIGINS

## Next Steps

1. Integrate appointments API
2. Integrate medications API
3. Integrate reports API
4. Add error handling and retry logic
5. Add offline support (optional)


