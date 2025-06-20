"use client"
import { NavLink, useNavigate } from "react-router-dom"
import {
  UserCircle,
  LogOut,
  Settings,
  Users,
  UserPlus,
  Layers,
  BookOpen,
  FileQuestion,
  BarChart,
  Clock,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import Button from "../ui/Button"

const adminLinks = [
  { to: "/admin", icon: <Layers size={20} />, text: "Dashboard" },
  { to: "/admin/create-user", icon: <UserPlus size={20} />, text: "Create Account" },
  { to: "/admin/manage-users", icon: <Users size={20} />, text: "Manage Users" },
  { to: "/admin/settings", icon: <Settings size={20} />, text: "Settings" },
]

const teacherLinks = [
  { to: "/teacher", icon: <Layers size={20} />, text: "Dashboard" },
  { to: "/teacher/create-quiz", icon: <FileQuestion size={20} />, text: "Create Quiz" },
  { to: "/teacher/quiz-results", icon: <BarChart size={20} />, text: "Quiz Results" },
  { to: "/teacher/course-details", icon: <BookOpen size={20} />, text: "Course Details" },
  { to: "/teacher/settings", icon: <Settings size={20} />, text: "Settings" },
]

const studentLinks = [
  { to: "/student", icon: <Layers size={20} />, text: "Dashboard" },
  { to: "/student/courses", icon: <BookOpen size={20} />, text: "Courses" },
  { to: "/student/quizzes", icon: <Clock size={20} />, text: "Quizzes" },
  { to: "/student/results", icon: <BarChart size={20} />, text: "My Results" },
  { to: "/student/settings", icon: <Settings size={20} />, text: "Settings" },
]

const Sidebar = () => {
  const { currentUser, userRole, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (error) {
      console.error("Failed to log out", error)
    }
  }

  // Select appropriate links based on user role
  let links = []
  let roleTitle = ""

  if (userRole === "admin") {
    links = adminLinks
    roleTitle = "Administrator"
  } else if (userRole === "teacher") {
    links = teacherLinks
    roleTitle = "Teacher"
  } else if (userRole === "student") {
    links = studentLinks
    roleTitle = "Student"
  }

  return (
    <div className="h-screen w-64 bg-white shadow-md flex flex-col">
      <div className="flex flex-col items-center p-6 border-b border-gray-200">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-2 overflow-hidden">
          {currentUser?.profileImage ? (
            <img
              src={currentUser.profileImage || "/placeholder.svg"}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <UserCircle size={40} className="text-primary-600" />
          )}
        </div>
        <h2 className="text-lg font-semibold">{currentUser?.displayName || currentUser?.email}</h2>
        <p className="text-sm text-gray-500">{roleTitle}</p>
      </div>

      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) => `
                  flex items-center px-4 py-2 rounded-md transition-colors duration-150
                  ${isActive ? "bg-primary-100 text-primary-700" : "text-gray-600 hover:bg-gray-100"}
                `}
                end={link.to.split("/").length <= 3}
              >
                <span className="mr-3">{link.icon}</span>
                <span>{link.text}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <Button variant="ghost" className="w-full flex items-center justify-center" onClick={handleLogout}>
          <LogOut size={18} className="mr-2" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  )
}

export default Sidebar
