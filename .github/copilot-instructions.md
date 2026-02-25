# SportSpot is a web application that allows users to find and book sports classes. The application provides a user-friendly interface for browsing available sports classes, checking their availability, and making reservations. The app is build with JS and Supabase as the backend. The main features of SportSpot include:
1. **Class Browsing**: Users can browse through a variety of sports classes, including yoga, pilates, spinning, and more. Each class listing includes details such as the instructor's name, class schedule, and location.
2. **Class Details**: Users can click on a class listing to view more detailed information about the class, including a description, class duration, and any prerequisites.
3. **Booking System**: Users can check the availability of classes and make reservations directly through the app. The booking system allows users to select a class, choose a time slot, and confirm their reservation.
4. **User Authentication**: Users can create an account and log in to the app to manage their bookings and view their reservation history. The authentication system ensures that user data is secure and private.
5. **Responsive Design**: The app is designed to be responsive, allowing users to access it from various devices, including desktops, tablets, and smartphones. The interface adapts to different screen sizes for an optimal user experience.

## Architecture and Tech Stack

Classical client-server app:
- **Frontend**: JavaScript, HTML, and CSS.
- **Backend**: Supabase
- **Database**: PostgreSQL (managed by Supabase)
- **Authentication**: Supabase Auth
- **API**: Supabase REST API
- **Hosting**: Netlify
- **Version Control**: GitHub

## UI Guidelines
Use HTML, CSS and vanilla JavaScript to create a clean and intuitive user interface for the app. Here are some guidelines to follow when designing the UI:
- **Styling**: Use a Bootstrap components and utilities to create a responsive and user-friendly interface.
- **Color Scheme**: Use a clean and modern color palette that is easy on the eyes. Consider using a combination of light and dark colors to create contrast and improve readability.
- **Typography**: Choose a clear and legible font for the app. Use different font sizes and weights to create a visual hierarchy and guide users through the content.
- **Navigation**: Implement a simple and intuitive navigation system that allows users to easily find and access different sections of the app. Consider using a sidebar or a top navigation bar for easy access to key features.
- **Responsiveness**: Ensure that the app is fully responsive and works well on various devices, including desktops, tablets, and smartphones. Use media queries and flexible layouts to adapt the UI to different screen sizes.
- **Accessibility**: Follow accessibility best practices to ensure that the app is usable by people with disabilities. This includes providing alternative text for images, using semantic HTML elements, and ensuring that the app can be navigated using a keyboard.
- **Consistency**: Maintain a consistent design language throughout the app. Use consistent colors, fonts, and UI elements to create a cohesive and professional look. This will help users feel more comfortable and familiar with the app as they navigate through it.
- **Feedback**: Provide clear feedback to users when they interact with the app. This can include visual cues such as loading indicators, success messages, and error messages to inform users about the status of their actions and guide them through the booking process.
- **Performance**: Optimize the app for performance to ensure a smooth and responsive user experience. This includes minimizing the use of large images, optimizing API calls, and using efficient coding practices to reduce load times and improve overall performance.

## Pages and Navigation
1. Split the app into multiple pages: login, registration, home, class details, booking, and user profile. This will help to organize the content and provide a clear structure for users to navigate through the app.
2. Implement pages as reusable components (HTML, CSS and JavaScript).
3. Use routing to navigate between pages.
4. Use a directory-based routing structure to achieve clean URLs without .html extensions.
  - Each page should reside in its own folder with an `index.html` file (e.g., `/classes/index.html`).
  - Navigation links must use absolute paths without extensions:
    - Home: `/`
    - All Classes: `/classes`
    - Class Details: `/class-details?id=uuid`
    - Calendar: `/calendar`
  - When navigating via JavaScript, use `window.location.assign('/classes')` or similar clean paths.
  - For dynamic routing like Class Details, use query parameters as primary state management: `/class-details?id={id}`.
4. Use full URLs like /home, /classes, /class-details, /booking, and /profile for better SEO and user experience.
- **Home Page(/)**: This page will display a Hero Banner with a call-to-action button to encourage users to browse classes. It will also include a common information section with details about the app's features and benefits.
- **Class Browsing Page(/classes)**: This page will allow users to browse through available sports classes. It will include filters and search functionality to help users find classes that match their preferences. Each class listing will include a summary of the class details and a link to the class details page.
- **Class Details Page(/class-details)**: This page will provide detailed information about a specific class, including the instructor's name, class schedule, location, and a booking button.
- **Booking Page(/booking)**: This page will allow users to select a class, choose a time slot, and confirm their reservation. It will also display the user's upcoming reservations.
- **User Profile Page(/profile)**: This page will allow users to manage their account information, view their booking history, and update their preferences. It will also include options for users to log out.
- **Navigation Component**: A reusable navigation component that can be included on all pages to provide easy access to key features such as the home page, class browsing, and user profile.
- **Class Card Component**: A reusable component that displays a summary of a class, including the class name, instructor's name, schedule, and a link to the class details page. This component can be used on the home page and in search results to provide a consistent and visually appealing way to display class information.
  - **Difficulty Indicators**: Each class must display its difficulty_level (1, 2, or 3) using a 3-bar visual system.
    - Level 1 (Easy): 1 active bar, 2 inactive.  
    - Level 2 (Moderate): 2 active bars, 1 inactive.  
    - Level 3 (Hard): 3 active bars. 

## Backend and Database
- Use Supabase as the backend for the app, which provides a PostgreSQL database, authentication, and a REST API.
- Design the database schema to include tables for users, classes, bookings, and any other relevant entities. Ensure that the schema is normalized and optimized for performance.
- Implement authentication using Supabase Auth to allow users to create accounts, log in, and manage their profiles securely.
- Use Supabase Storage for file uploads (e.g., class images and user profile images) and ensure that the storage is properly configured for security and performance.
- After applying a migration in Supabase, keep a copy of the migration SQL file in the project repository for version control and documentation purposes.

## Authentication and Authenication Flow
- Implement user authentication using Supabase Auth, which provides a secure and easy-to-use authentication system. This will allow users to create accounts, log in, and manage their profiles securely.
- The authentication flow should include the following steps:
  1. **Registration**: Users can create an account by providing their name, email address and a password. The registration process should include validation to ensure that the email address is valid and the password meets security requirements.
  2. **Login**: Users can log in to the app using their email address and password. The login process should include error handling to provide feedback if the credentials are incorrect.
  3. **Password Reset**: Users should have the option to reset their password if they forget it. This can be implemented using Supabase's built-in password reset functionality, which sends a password reset email to the user.
  4. **Session Management**: Once logged in, users should have a session that allows them to access protected routes and features of the app. The session should be securely managed using Supabase's authentication tokens.
  5. **Logout**: Users should have the option to log out of their account, which will end their session and require them to log in again to access protected features.
- **RBAC Architecture**: Implement Role-Based Access Control using a dedicated user_roles table linked to profiles. Use a PostgreSQL enum app_role with values ('admin', 'user') to enforce data integrity.
- **Permissions**:
  - Admins (Trainers): Have full CRUD permissions (Create, Read, Update, Delete) on workout classes and schedule slots.
  - Users (Clients): Can view available classes and manage (create/cancel) their own bookings.
- **RLS Implementation**: Enable Row-Level Security (RLS) on all tables. Policies must verify permissions by querying the user_roles table to determine if the authenticated auth.uid() has the required admin or user role for the specific operation.