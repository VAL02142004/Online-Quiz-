import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Login from "./pages/Login"
import AdminDashboard from "./pages/admin/Dashboard"
import CreateUser from "./pages/admin/CreateUser"
import ManageUsers from "./pages/admin/ManageUsers"
import AdminSettings from "./pages/admin/Settings"
import TeacherDashboard from "./pages/teacher/Dashboard"
import CreateQuiz from "./pages/teacher/CreateQuiz"
import QuizResults from "./pages/teacher/QuizResults"
import CourseDetails from "./pages/teacher/CourseDetails"
import TeacherSettings from "./pages/teacher/Settings"
import StudentDashboard from "./pages/student/Dashboard"
import TakeQuiz from "./pages/student/TakeQuiz"
import ViewResults from "./pages/student/ViewResults"
import CourseEnrollment from "./pages/student/CourseEnrollment"
import StudentSettings from "./pages/student/Settings"
import StudentQuizzes from "./pages/student/StudentQuizzes"
import NotFound from "./pages/NotFound"
import AdminRegister from "./pages/admin/AdminRegister"
import Study from "./pages/student/Study"

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "#FFFFFF",
                  color: "#096B68",
                },
                success: {
                  iconTheme: {
                    primary: "#129990",
                    secondary: "#FFFFFF",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "#EF4444",
                    secondary: "#FFFFFF",
                  },
                },
              }}
            />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/admin/register" element={<AdminRegister />} />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/create-user"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <CreateUser />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/manage-users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <ManageUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />

              {/* Teacher Routes */}
              <Route
                path="/teacher"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/create-quiz"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <CreateQuiz />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/quiz-results"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <QuizResults />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/course-details"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <CourseDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/settings"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherSettings />
                  </ProtectedRoute>
                }
              />

              {/* Student Routes */}
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/quizzes"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentQuizzes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/quizzes/:quizId"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <TakeQuiz />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/take-quiz/:quizId"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <TakeQuiz />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/results"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <ViewResults />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/courses"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <CourseEnrollment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/study/:courseId"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <Study />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/settings"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentSettings />
                  </ProtectedRoute>
                }
              />

              {/* Default Routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App