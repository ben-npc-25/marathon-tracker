# Marathon Tracker

**AI-Powered Marathon Training Companion**

Marathon Tracker is a modern, adaptive training application designed to help runners achieve their marathon goals. Powered by **Google Gemini**, it generates personalized training plans, adapts to your progress, and provides real-time AI coaching.

## ✨ Key Features

- **🏃‍♂️ AI Plan Generation**: Create custom training plans based on your race date, current fitness, and specific goals (e.g., "Sub-4 Tokyo Marathon").
- **🤖 Adaptive Coaching**: The AI Coach reviews your logs and adjusts future workouts if you miss training or progress faster/slower than expected.
- **💬 Interactive Coach Chat**: Chat with your AI Coach for advice on injuries, pacing, nutrition, or schedule adjustments.
- **📊 Progress Tracking**: Log your runs with details like distance, time, RPE (Rate of Perceived Exertion), and notes.
- **📈 Performance Analysis**: Get instant AI feedback on individual workouts to understand your performance.
- **📱 Mobile-First PWA**: Installable on mobile devices (iOS/Android) for a native app-like experience.

## 🛠️ Technology Stack

- **Frontend**: [React](https://react.dev/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) (Icons)
- **Backend / Database**: [Firebase](https://firebase.google.com/) (Authentication, Firestore)
- **AI Engine**: [Google Gemini API](https://ai.google.dev/) (gemini-2.5-flash-preview)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- A Firebase project with Authentication and Firestore enabled.
- A Google Gemini API Key.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/marathon-tracker.git
   cd marathon-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your keys:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

## 📱 Mobile Installation (PWA)

1. Open the app in your mobile browser (Safari on iOS, Chrome on Android).
2. Tap the "Share" button (iOS) or Menu (Android).
3. Select **"Add to Home Screen"**.

## 📄 License

MIT
