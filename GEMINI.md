# Project: Card-Scout

## Project Overview

This is a React Native mobile application built with Expo, designed to help users find and track trading cards. The application uses Supabase as its backend for data storage and authentication, and appears to be specifically tailored for the One Piece trading card game.

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Backend**: Supabase
- **Key Libraries**:
  - `@supabase/supabase-js`: For interacting with the Supabase backend.
  - `expo-router`: For navigation within the app.
  - `justtcg-js`: A library for trading card game functionality.

## Building and Running

To get started with the application, you'll need to have Node.js and the Expo CLI installed.

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Set up Environment Variables**:
    Create a `.env` file in the root of the project and add your Supabase credentials:
    ```
    EXPO_PUBLIC_SUPABASE_KEY=your_supabase_api_key
    ```

3.  **Run the Application**:
    You can run the app on different platforms using the following commands:
    - **Android**: `npm run android`
    - **iOS**: `npm run ios`
    - **Web**: `npm run web`

    To start the development server, you can run:
    ```bash
    npm run start
    ```

4.  **Seed the Database**:
    The project includes a seed script to populate the database with initial data.
    ```bash
    npm run seed
    ```

## Development Conventions

- **State Management**: The application uses React's built-in state management. For more complex state, consider using a library like Zustand or React Context.
- **Styling**: Styles are written using React Native's `StyleSheet` API.
- **Data Fetching**: Data is fetched from the Supabase backend using the `@supabase/supabase-js` library.
- **Testing**: There are no explicit testing configurations in the project. It is recommended to add a testing framework like Jest or React Testing Library.
