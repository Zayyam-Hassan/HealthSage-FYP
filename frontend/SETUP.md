# Quick Setup Guide

## 1. Install AsyncStorage

```bash
cd movie-app
npm install @react-native-async-storage/async-storage
```

## 2. Start Backend

```bash
cd backend
# Make sure MongoDB is running
python run.py
```

Backend will run on `http://localhost:8000`

## 3. Configure API URL (if needed)

If testing on a physical device, edit `movie-app/services/config.ts`:

```typescript
export const API_BASE_URL = 'http://YOUR_IP_ADDRESS:8000/api/v1';
```

## 4. Start Frontend

```bash
cd movie-app
npm start
```

## 5. Test the Integration

1. **Sign Up**: Create a new account
2. **Login**: Sign in with your credentials
3. **Create Patient**: Add a new patient with all fields
4. **View Patients**: See the list of patients from database
5. **Check MongoDB**: Open Compass to see the data

## Collections Created

After using the app, you'll see these collections in MongoDB:

- `users` - User accounts
- `patients` - Patient records
- `doctors` - Doctor records (when integrated)
- `medications` - Medication data (when integrated)
- `appointments` - Appointment records (when integrated)
- `reports` - Report documents (when integrated)
- `ai_results` - AI prediction results (when integrated)

## Troubleshooting

### Can't connect to backend
- Make sure backend is running: `python backend/run.py`
- Check API URL in `services/config.ts`
- For physical device, use IP address not localhost

### No collections in MongoDB
- Collections only appear after data is inserted
- Create a user and patient first
- Run `python backend/test_connection.py` to test

### 401 Unauthorized
- Make sure you're logged in
- Token might be expired, try logging in again


