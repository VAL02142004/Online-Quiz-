"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "react-hot-toast"
import { createUserWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider, signInWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore"
import { auth, db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Input from "../../components/ui/Input"
import Button from "../../components/ui/Button"
import { UserPlus, GraduationCap, School, Eye, EyeOff, AlertCircle, CheckCircle, Shield } from "lucide-react"
import Modal from "../../components/ui/Modal"

const CreateUser = () => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm()
  const [userType, setUserType] = useState("student")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const { currentUser, logout, login } = useAuth()
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [adminAuthError, setAdminAuthError] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminSession, setAdminSession] = useState(null)

  // Watch form values for real-time validation
  const watchedEmail = watch("email")
  const watchedStudentId = watch("studentId")
  const watchedEmployeeId = watch("employeeId")

  // Check if current user is admin and maintain session
  useEffect(() => {
    if (!currentUser) {
      toast.error("Please log in to access this page.")
      return
    }

    const checkAdminRole = async () => {
      try {
        const userDoc = await getDocs(
          query(collection(db, "users"), where("email", "==", currentUser.email), where("role", "==", "admin")),
        )

        if (userDoc.empty) {
          toast.error("Access denied. Admin privileges required.")
          setIsAdmin(false)
          await logout()
        } else {
          setIsAdmin(true)
          // Store admin session info
          setAdminSession({
            email: currentUser.email,
            uid: currentUser.uid,
            lastActive: new Date().toISOString()
          })
          // Update last active time in Firestore
          await updateDoc(doc(db, "users", currentUser.uid), {
            lastActive: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error("Error checking admin role:", error)
        toast.error("Error verifying admin privileges.")
        setIsAdmin(false)
      }
    }

    checkAdminRole()

    // Set up interval to maintain admin session
    const sessionInterval = setInterval(async () => {
      if (currentUser && isAdmin) {
        try {
          await updateDoc(doc(db, "users", currentUser.uid), {
            lastActive: new Date().toISOString()
          })
        } catch (error) {
          console.error("Error updating admin session:", error)
        }
      }
    }, 300000) // Update every 5 minutes

    return () => clearInterval(sessionInterval)
  }, [currentUser, isAdmin, logout])

  // Real-time email validation
  useEffect(() => {
    if (watchedEmail && watchedEmail.length > 0) {
      validateEmail(watchedEmail)
    }
  }, [watchedEmail])

  // Real-time ID validation
  useEffect(() => {
    if (userType === "student" && watchedStudentId) {
      validateStudentId(watchedStudentId)
    } else if (userType === "teacher" && watchedEmployeeId) {
      validateEmployeeId(watchedEmployeeId)
    }
  }, [watchedStudentId, watchedEmployeeId, userType])

  const validateEmail = async (email) => {
    if (!email || email.length < 3) return

    try {
      const emailQuery = query(collection(db, "users"), where("email", "==", email))
      const emailSnapshot = await getDocs(emailQuery)

      if (!emailSnapshot.empty) {
        setValidationErrors((prev) => ({
          ...prev,
          email: "Email is already registered",
        }))
      } else {
        setValidationErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.email
          return newErrors
        })
      }
    } catch (error) {
      console.error("Email validation error:", error)
    }
  }

  const validateStudentId = async (studentId) => {
    if (!studentId || studentId.length < 3) return

    try {
      const studentIdQuery = query(
        collection(db, "users"),
        where("studentId", "==", studentId),
        where("role", "==", "student"),
      )
      const studentIdSnapshot = await getDocs(studentIdQuery)

      if (!studentIdSnapshot.empty) {
        setValidationErrors((prev) => ({
          ...prev,
          studentId: "Student ID is already in use",
        }))
      } else {
        setValidationErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.studentId
          return newErrors
        })
      }
    } catch (error) {
      console.error("Student ID validation error:", error)
    }
  }

  const validateEmployeeId = async (employeeId) => {
    if (!employeeId || employeeId.length < 3) return

    try {
      const employeeIdQuery = query(
        collection(db, "users"),
        where("employeeId", "==", employeeId),
        where("role", "==", "teacher"),
      )
      const employeeIdSnapshot = await getDocs(employeeIdQuery)

      if (!employeeIdSnapshot.empty) {
        setValidationErrors((prev) => ({
          ...prev,
          employeeId: "Employee ID is already in use",
        }))
      } else {
        setValidationErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.employeeId
          return newErrors
        })
      }
    } catch (error) {
      console.error("Employee ID validation error:", error)
    }
  }

  const generateUniqueId = (type) => {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
    const prefix = type === "student" ? "STU" : "EMP"
    return `${prefix}${timestamp}${random}`
  }

  const verifyAdminPassword = async () => {
    if (!adminPassword) {
      setAdminAuthError("Please enter your password")
      return false
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, adminPassword)
      await reauthenticateWithCredential(currentUser, credential)
      setAdminAuthError("")
      setShowAdminAuthModal(false)
      return true
    } catch (error) {
      console.error("Admin verification error:", error)
      setAdminAuthError("Incorrect password. Please try again.")
      return false
    }
  }

  const onSubmit = async (data) => {
    if (!isAdmin) {
      toast.error("Admin privileges required to create users.")
      return
    }

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix validation errors before submitting.")
      return
    }

    setShowAdminAuthModal(true)
  }

  const handleAdminVerifiedSubmit = async (data) => {
    setLoading(true)
    let newUserAuth = null
    let adminEmail = currentUser.email
    let adminPass = adminPassword

    try {
      // Create authentication account
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password)
      newUserAuth = userCredential.user

      // Prepare user data
      const userData = {
        uid: newUserAuth.uid,
        email: data.email,
        name: data.name.trim(),
        address: data.address.trim(),
        phone: data.phone.trim(),
        role: userType,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        isActive: true,
        profileImage: null,
        lastLogin: null,
        sessionActive: false,
        lastActive: null
      }

      // Add role-specific data
      if (userType === "student") {
        userData.yearLevel = data.yearLevel.trim()
        userData.studentId = data.studentId.trim() || generateUniqueId("student")
        userData.enrolledCourses = []
        userData.completedQuizzes = []
      } else {
        userData.gradeLevel = data.gradeLevel.trim()
        userData.subject = data.subject.trim()
        userData.employeeId = data.employeeId.trim() || generateUniqueId("teacher")
        userData.assignedCourses = []
        userData.createdQuizzes = []
      }

      // Save user data to Firestore
      await setDoc(doc(db, "users", newUserAuth.uid), userData)

      // Create user profile document
      await setDoc(doc(db, "userProfiles", newUserAuth.uid), {
        uid: newUserAuth.uid,
        displayName: userData.name,
        bio: "",
        preferences: {
          notifications: true,
          emailUpdates: true,
          theme: "light",
        },
        stats:
          userType === "student"
            ? {
                coursesEnrolled: 0,
                quizzesCompleted: 0,
                averageScore: 0,
                totalStudyTime: 0,
              }
            : {
                coursesCreated: 0,
                quizzesCreated: 0,
                studentsManaged: 0,
                averageStudentScore: 0,
              },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Success notification
      toast.success(
        `${userType.charAt(0).toUpperCase() + userType.slice(1)} account registered successfully!`,
        {
          icon: userType === "student" ? <GraduationCap size={20} /> : <School size={20} />,
          duration: 6000,
          style: {
            background: "#f0fdf4",
            color: "#166534",
            border: "1px solid #bbf7d0",
          },
        }
      )

      // Reset form
      reset()
      setValidationErrors({})
      setAdminPassword("")
      setShowAdminAuthModal(false)

      // Log the creation for audit
      console.log(`${userType} account created:`, {
        uid: newUserAuth.uid,
        email: data.email,
        name: data.name,
        createdBy: currentUser.email,
        timestamp: new Date().toISOString(),
      })

      // Re-authenticate admin to maintain session
      await signInWithEmailAndPassword(auth, adminEmail, adminPass)

    } catch (error) {
      console.error("Create user error:", error)

      // Clean up auth account if Firestore save failed
      if (newUserAuth) {
        try {
          await newUserAuth.delete()
        } catch (deleteError) {
          console.error("Error cleaning up auth account:", deleteError)
        }
      }

      // Handle specific errors
      let errorMessage = `Failed to create ${userType} account.`

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "Email address is already registered."
          break
        case "auth/invalid-email":
          errorMessage = "Please enter a valid email address."
          break
        case "auth/weak-password":
          errorMessage = "Password must be at least 6 characters long."
          break
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your connection."
          break
        case "permission-denied":
          errorMessage = "Permission denied. Please check your admin privileges."
          break
        default:
          errorMessage = error.message || errorMessage
      }

      toast.error(errorMessage, {
        duration: 5000,
        style: {
          background: "#fef2f2",
          color: "#b91c1c",
          border: "1px solid #fecaca",
        },
      })
    } finally {
      setLoading(false)
    }
  }

  const userTypeOptions = [
    {
      value: "student",
      label: "Student",
      icon: <GraduationCap size={20} />,
      color: "green",
    },
    {
      value: "teacher",
      label: "Teacher",
      icon: <School size={20} />,
      color: "blue",
    },
  ]

  if (!isAdmin) {
    return (
      <DashboardLayout title="Access Denied">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 animate-fade-in">
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 flex items-center justify-center bg-red-100 rounded-full mb-4">
              <Shield size={32} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Admin Access Required</h2>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this page. Please contact your system administrator.
            </p>
            <Button href="/dashboard" className="px-6 py-2">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Create User Account">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            <UserPlus size={32} className="text-indigo-600" />
            Create New {userType === "student" ? "Student" : "Teacher"} Account
          </h1>
          <p className="text-gray-600">Fill in the details below to create a new {userType} account in the system.</p>
        </div>

        {/* User Type Selector */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-3">Account Type</label>
          <div className="flex gap-4">
            {userTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setUserType(option.value)
                  setValidationErrors({})
                  reset()
                }}
                className={`flex items-center gap-3 px-6 py-3 rounded-lg border-2 transition-all duration-200 ${
                  userType === option.value
                    ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {option.icon}
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CheckCircle size={20} className="text-green-600" />
                Basic Information
              </h3>
            </div>

            <Input
              label="Full Name"
              {...register("name", {
                required: "Full name is required",
                minLength: { value: 2, message: "Name must be at least 2 characters" },
                pattern: { value: /^[a-zA-Z\s]+$/, message: "Name can only contain letters and spaces" },
              })}
              error={errors.name?.message}
              placeholder="Enter full name"
            />

            <div className="relative">
              <Input
                label="Email Address"
                type="email"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Please enter a valid email address",
                  },
                })}
                error={errors.email?.message || validationErrors.email}
                placeholder="Enter email address"
              />
              {watchedEmail && !validationErrors.email && !errors.email && (
                <CheckCircle size={16} className="absolute right-3 top-9 text-green-500" />
              )}
            </div>

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 6, message: "Password must be at least 6 characters" },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message:
                      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
                  },
                })}
                error={errors.password?.message}
                placeholder="Enter secure password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Input
              label="Phone Number"
              type="tel"
              {...register("phone", {
                required: "Phone number is required",
                pattern: {
                  value: /^[+]?[1-9][\d]{0,15}$/,
                  message: "Please enter a valid phone number",
                },
              })}
              error={errors.phone?.message}
              placeholder="Enter phone number"
            />

            <div className="md:col-span-2">
              <Input
                label="Address"
                {...register("address", {
                  required: "Address is required",
                  minLength: { value: 10, message: "Address must be at least 10 characters" },
                })}
                error={errors.address?.message}
                placeholder="Enter complete address"
              />
            </div>
          </div>

          {/* Role-specific Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                {userType === "student" ? (
                  <GraduationCap size={20} className="text-green-600" />
                ) : (
                  <School size={20} className="text-blue-600" />
                )}
                {userType === "student" ? "Student" : "Teacher"} Information
              </h3>
            </div>

            {userType === "student" ? (
              <>
                <Input
                  label="Year Level"
                  type="number"
                  min="1"
                  max="12"
                  {...register("yearLevel", {
                    required: "Year level is required",
                    min: { value: 1, message: "Year level must be between 1 and 12" },
                    max: { value: 12, message: "Year level must be between 1 and 12" },
                  })}
                  error={errors.yearLevel?.message}
                  placeholder="Enter year level (1-12)"
                />

                <div className="relative">
                  <Input
                    label="Student ID"
                    {...register("studentId", {
                      required: "Student ID is required",
                      minLength: { value: 3, message: "Student ID must be at least 3 characters" },
                    })}
                    error={errors.studentId?.message || validationErrors.studentId}
                    placeholder="Enter student ID"
                  />
                  {watchedStudentId && !validationErrors.studentId && !errors.studentId && (
                    <CheckCircle size={16} className="absolute right-3 top-9 text-green-500" />
                  )}
                </div>
              </>
            ) : (
              <>
                <Input
                  label="Grade Level Teaching"
                  {...register("gradeLevel", {
                    required: "Grade level is required",
                    minLength: { value: 2, message: "Grade level must be at least 2 characters" },
                  })}
                  error={errors.gradeLevel?.message}
                  placeholder="e.g., Grade 10-12, Elementary"
                />

                <Input
                  label="Subject Specialization"
                  {...register("subject", {
                    required: "Subject is required",
                    minLength: { value: 2, message: "Subject must be at least 2 characters" },
                  })}
                  error={errors.subject?.message}
                  placeholder="e.g., Mathematics, Science, English"
                />

                <div className="relative md:col-span-2">
                  <Input
                    label="Employee ID"
                    {...register("employeeId", {
                      required: "Employee ID is required",
                      minLength: { value: 3, message: "Employee ID must be at least 3 characters" },
                    })}
                    error={errors.employeeId?.message || validationErrors.employeeId}
                    placeholder="Enter employee ID"
                  />
                  {watchedEmployeeId && !validationErrors.employeeId && !errors.employeeId && (
                    <CheckCircle size={16} className="absolute right-3 top-9 text-green-500" />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-6 border-t border-gray-200">
            <Button
              type="submit"
              className="w-full md:w-auto px-8 py-3 text-lg font-medium"
              disabled={loading || Object.keys(validationErrors).length > 0}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating Account...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UserPlus size={20} />
                  Create {userType === "student" ? "Student" : "Teacher"} Account
                </div>
              )}
            </Button>

            {Object.keys(validationErrors).length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">Please fix the following errors:</span>
                </div>
                <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                  {Object.values(validationErrors).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Admin Authentication Modal */}
      <Modal
        isOpen={showAdminAuthModal}
        onClose={() => {
          setShowAdminAuthModal(false)
          setAdminPassword("")
          setAdminAuthError("")
        }}
        title="Admin Verification"
        icon={<Shield size={24} className="text-indigo-600" />}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            For security reasons, please confirm your admin password to proceed with account creation.
          </p>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Admin Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your admin password"
            />
            {adminAuthError && <p className="text-sm text-red-600">{adminAuthError}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAdminAuthModal(false)
                setAdminPassword("")
                setAdminAuthError("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const isVerified = await verifyAdminPassword()
                if (isVerified) {
                  handleAdminVerifiedSubmit(watch())
                }
              }}
            >
              Verify & Create Account
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}

export default CreateUser