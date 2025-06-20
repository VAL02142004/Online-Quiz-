"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { toast } from "react-hot-toast"
import { db, storage } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { BookOpen, Plus, Edit, Trash2, Check, X, Users, FileText, Download, Upload, File, FileInput, FileArchive } from "lucide-react"

// Handle Firebase index error
const handleFirebaseIndexError = (error) => {
  if (error.code === "failed-precondition" && error.message.includes("requires an index")) {
    const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)
    if (indexUrl) {
      console.warn("Firebase requires an index. Please create it at:", indexUrl[0])
      toast.error(
        <div>
          <p>This query requires a Firestore index.</p>
          <a href={indexUrl[0]} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
            Click here to create it
          </a>
        </div>,
        { duration: 10000 },
      )
    }
  }
  return error
}

const CourseDetails = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()
  const { currentUser } = useAuth()
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState({
    courses: false,
    enrollments: false,
    materials: false,
    actions: false,
    fileUpload: false,
    exportLoading: false,
    importLoading: false,
  })
  const [isCreating, setIsCreating] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [activeTab, setActiveTab] = useState("courses")
  const [selectedCourse, setSelectedCourse] = useState(null)
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)

  const fetchCourses = async () => {
    if (!currentUser) return

    setLoading((prev) => ({ ...prev, courses: true }))

    try {
      const coursesQuery = query(collection(db, "courses"), where("teacherId", "==", currentUser.uid))
      const coursesSnapshot = await getDocs(coursesQuery)

      const coursesData = await Promise.all(
        coursesSnapshot.docs.map(async (doc) => {
          const courseData = doc.data()
          let teacherName = currentUser.displayName || "Unknown Teacher"

          if (courseData.teacherId && !teacherName) {
            const teacherDoc = await getDoc(doc(db, "users", courseData.teacherId))
            if (teacherDoc.exists()) {
              teacherName = teacherDoc.data().name || teacherDoc.data().email || teacherName
            }
          }

          return {
            id: doc.id,
            ...courseData,
            teacherName,
          }
        }),
      )

      setCourses(coursesData)
    } catch (error) {
      console.error("Error fetching courses:", error)
      handleFirebaseIndexError(error)
      toast.error("Failed to load courses. Please try again.")
      throw error
    } finally {
      setLoading((prev) => ({ ...prev, courses: false }))
    }
  }

  const fetchEnrollments = async (courseId) => {
    if (!courseId) return

    setLoading((prev) => ({ ...prev, enrollments: true }))

    try {
      const enrollmentsQuery = query(collection(db, "enrollments"), where("courseId", "==", courseId))
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery)

      const enrollmentsData = await Promise.all(
        enrollmentsSnapshot.docs.map(async (docSnapshot) => {
          const enrollmentData = docSnapshot.data()
          let studentName = "Unknown Student"
          let studentEmail = ""

          if (enrollmentData.studentId) {
            const studentDoc = await getDoc(doc(db, "users", enrollmentData.studentId))
            if (studentDoc.exists()) {
              studentName = studentDoc.data().name || studentDoc.data().email || studentName
              studentEmail = studentDoc.data().email || ""
            }
          }

          return {
            id: docSnapshot.id,
            ...enrollmentData,
            studentName,
            studentEmail,
          }
        }),
      )

      setEnrollments(enrollmentsData)

      // Update course document with enrolled students
      const approvedStudents = enrollmentsData.filter((e) => e.status === "approved").map((e) => e.studentId)

      const courseRef = doc(db, "courses", courseId)
      await updateDoc(courseRef, {
        enrolledStudents: approvedStudents,
      })
    } catch (error) {
      console.error("Error fetching enrollments:", error)
      handleFirebaseIndexError(error)
      toast.error("Failed to load enrollments. Please try again.")
      throw error
    } finally {
      setLoading((prev) => ({ ...prev, enrollments: false }))
    }
  }

  const fetchMaterials = async (courseId) => {
    if (!courseId) return

    setLoading((prev) => ({ ...prev, materials: true }))

    try {
      const materialsQuery = query(collection(db, "materials"), where("courseId", "==", courseId))
      const materialsSnapshot = await getDocs(materialsQuery)

      const materialsData = materialsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setMaterials(materialsData)
    } catch (error) {
      console.error("Error fetching materials:", error)
      toast.error("Failed to load study materials. Please try again.")
      throw error
    } finally {
      setLoading((prev) => ({ ...prev, materials: false }))
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchCourses()
      } catch (error) {
        // Error already handled in fetchCourses
      }
    }

    loadData()
  }, [currentUser])

  const createCourse = async (data) => {
    setLoading((prev) => ({ ...prev, actions: true }))

    try {
      const courseData = {
        name: data.name,
        description: data.description,
        gradeLevel: data.gradeLevel,
        subject: data.subject,
        schedule: data.schedule,
        location: data.location,
        syllabus: data.syllabus || "",
        objectives: data.objectives || "",
        prerequisites: data.prerequisites || "",
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || "Unknown Teacher",
        createdAt: new Date().toISOString(),
        enrolledStudents: [],
      }

      await addDoc(collection(db, "courses"), courseData)

      toast.success("Course created successfully!")
      reset()
      setIsCreating(false)
      await fetchCourses()
    } catch (error) {
      console.error("Error creating course:", error)
      toast.error("Failed to create course. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const updateCourse = async (data) => {
    if (!editingCourse) return

    setLoading((prev) => ({ ...prev, actions: true }))

    try {
      const courseRef = doc(db, "courses", editingCourse.id)
      await updateDoc(courseRef, {
        name: data.name,
        description: data.description,
        gradeLevel: data.gradeLevel,
        subject: data.subject,
        schedule: data.schedule,
        location: data.location,
        syllabus: data.syllabus || "",
        objectives: data.objectives || "",
        prerequisites: data.prerequisites || "",
        updatedAt: new Date().toISOString(),
      })

      toast.success("Course updated successfully!")
      reset()
      setEditingCourse(null)
      await fetchCourses()
    } catch (error) {
      console.error("Error updating course:", error)
      toast.error("Failed to update course. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const deleteCourse = async (courseId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this course? This will also delete all associated quizzes, materials, and enrollments.",
      )
    ) {
      setLoading((prev) => ({ ...prev, actions: true }))

      try {
        // First delete all related materials
        const materialsQuery = query(collection(db, "materials"), where("courseId", "==", courseId))
        const materialsSnapshot = await getDocs(materialsQuery)
        
        const materialDeletePromises = materialsSnapshot.docs.map(async (doc) => {
          // Delete the file from storage if it exists
          if (doc.data().fileUrl) {
            const fileRef = ref(storage, doc.data().fileUrl)
            await deleteObject(fileRef).catch(error => {
              console.error("Error deleting file:", error)
            })
          }
          return deleteDoc(doc.ref)
        })

        // Delete all related enrollments
        const enrollmentsQuery = query(collection(db, "enrollments"), where("courseId", "==", courseId))
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery)
        const enrollmentDeletePromises = enrollmentsSnapshot.docs.map((doc) => deleteDoc(doc.ref))

        await Promise.all([
          ...materialDeletePromises,
          ...enrollmentDeletePromises,
          deleteDoc(doc(db, "courses", courseId))
        ])

        toast.success("Course and all related data deleted successfully!")
        await fetchCourses()

        if (selectedCourse?.id === courseId) {
          setSelectedCourse(null)
          setActiveTab("courses")
        }
      } catch (error) {
        console.error("Error deleting course:", error)
        toast.error("Failed to delete course. Please try again.")
      } finally {
        setLoading((prev) => ({ ...prev, actions: false }))
      }
    }
  }

  const updateEnrollmentStatus = async (enrollmentId, status) => {
    setLoading((prev) => ({ ...prev, actions: true }))

    try {
      const enrollmentRef = doc(db, "enrollments", enrollmentId)
      await updateDoc(enrollmentRef, {
        status,
        updatedAt: new Date().toISOString(),
      })

      // Update the UI and course document
      const updatedEnrollments = enrollments.map((enrollment) =>
        enrollment.id === enrollmentId ? { ...enrollment, status } : enrollment,
      )

      setEnrollments(updatedEnrollments)

      // Update course's enrolledStudents array
      const enrollment = enrollments.find((e) => e.id === enrollmentId)
      if (enrollment) {
        const courseRef = doc(db, "courses", enrollment.courseId)
        const courseSnap = await getDoc(courseRef)
        const currentEnrolled = courseSnap.data()?.enrolledStudents || []

        let newEnrolled
        if (status === "approved") {
          newEnrolled = [...new Set([...currentEnrolled, enrollment.studentId])]
        } else {
          newEnrolled = currentEnrolled.filter((id) => id !== enrollment.studentId)
        }

        await updateDoc(courseRef, {
          enrolledStudents: newEnrolled,
        })
      }

      toast.success(`Enrollment ${status === "approved" ? "approved" : "rejected"}`)
    } catch (error) {
      console.error("Error updating enrollment:", error)
      toast.error("Failed to update enrollment status. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files || !files.length || !selectedCourse) return

    setLoading((prev) => ({ ...prev, fileUpload: true }))

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        const validTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ]
        
        if (!validTypes.includes(file.type)) {
          throw new Error(`Invalid file type for ${file.name}. Only PDF, DOC, DOCX, and TXT files are allowed.`)
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} is too large. Maximum size is 10MB.`)
        }

        // Upload file to Firebase Storage
        const storageRef = ref(storage, `materials/${selectedCourse.id}/${file.name}-${Date.now()}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadURL = await getDownloadURL(snapshot.ref)

        // Save file metadata to Firestore
        return addDoc(collection(db, "materials"), {
          courseId: selectedCourse.id,
          name: file.name,
          type: file.type,
          size: file.size,
          fileUrl: downloadURL,
          createdAt: new Date().toISOString(),
          uploadedBy: currentUser.uid,
        })
      })

      await Promise.all(uploadPromises)
      toast.success(`${files.length > 1 ? 'Files' : 'File'} uploaded successfully!`)
      await fetchMaterials(selectedCourse.id)
    } catch (error) {
      console.error("Error uploading file:", error)
      toast.error(error.message || "Failed to upload files. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, fileUpload: false }))
      e.target.value = "" // Reset file input
    }
  }

  const handleImportMaterials = async (e) => {
    const files = e.target.files
    if (!files || !files.length || !selectedCourse) return

    setLoading((prev) => ({ ...prev, importLoading: true }))

    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const zipFile = files[0]
      const zipContent = await zip.loadAsync(zipFile)

      // Process each file in the zip
      const filePromises = Object.keys(zipContent.files).map(async (filename) => {
        const zipEntry = zipContent.files[filename]
        if (zipEntry.dir) return null // Skip directories

        const fileData = await zipEntry.async('blob')
        const file = new File([fileData], filename, { type: fileData.type })

        // Validate file type
        const validTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ]
        
        if (!validTypes.includes(file.type)) {
          console.warn(`Skipping invalid file type: ${filename}`)
          return null
        }

        // Upload the file
        const storageRef = ref(storage, `materials/${selectedCourse.id}/${filename}-${Date.now()}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadURL = await getDownloadURL(snapshot.ref)

        // Save to Firestore
        return addDoc(collection(db, "materials"), {
          courseId: selectedCourse.id,
          name: filename,
          type: file.type,
          size: file.size,
          fileUrl: downloadURL,
          createdAt: new Date().toISOString(),
          uploadedBy: currentUser.uid,
        })
      })

      const results = await Promise.all(filePromises)
      const successfulUploads = results.filter(r => r !== null).length
      
      toast.success(`Imported ${successfulUploads} files from zip archive!`)
      await fetchMaterials(selectedCourse.id)
    } catch (error) {
      console.error("Error importing materials:", error)
      toast.error(error.message || "Failed to import materials. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, importLoading: false }))
      e.target.value = "" // Reset file input
    }
  }

  const deleteMaterial = async (materialId, fileUrl) => {
    if (!window.confirm("Are you sure you want to delete this material?")) return

    setLoading((prev) => ({ ...prev, actions: true }))

    try {
      // Delete the file from storage if it exists
      if (fileUrl) {
        const fileRef = ref(storage, fileUrl)
        await deleteObject(fileRef)
      }

      // Delete the document from Firestore
      await deleteDoc(doc(db, "materials", materialId))

      toast.success("Material deleted successfully!")
      await fetchMaterials(selectedCourse.id)
    } catch (error) {
      console.error("Error deleting material:", error)
      toast.error("Failed to delete material. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, actions: false }))
    }
  }

  const exportMaterialsAsZip = async () => {
    if (!selectedCourse || !materials.length) return

    setLoading((prev) => ({ ...prev, exportLoading: true }))

    try {
      // Create a zip file using JSZip
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const folder = zip.folder(`${selectedCourse.name}-materials`)

      // Fetch all files and add them to the zip
      await Promise.all(materials.map(async (material) => {
        try {
          const response = await fetch(material.fileUrl)
          if (!response.ok) throw new Error(`Failed to fetch ${material.name}`)
          const blob = await response.blob()
          folder.file(material.name, blob)
        } catch (error) {
          console.error(`Error fetching file ${material.name}:`, error)
          throw new Error(`Failed to fetch ${material.name}`)
        }
      }))

      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' })

      // Create download link
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedCourse.name}-materials.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Materials exported successfully!")
    } catch (error) {
      console.error("Error exporting materials:", error)
      toast.error(error.message || "Failed to export materials. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, exportLoading: false }))
    }
  }

  const onSubmit = async (data) => {
    if (editingCourse) {
      await updateCourse(data)
    } else {
      await createCourse(data)
    }
  }

  const handleManageCourse = async (course) => {
    setSelectedCourse(course)
    setActiveTab("materials")
    try {
      await Promise.all([
        fetchEnrollments(course.id),
        fetchMaterials(course.id)
      ])
    } catch (error) {
      // Error already handled in fetch functions
    }
  }

  return (
    <DashboardLayout title="Course Management">
      <div className="animate-fade-in">
        {/* Tabs */}
        <div className="mb-6 flex border-b border-gray-200">
          <button
            className={`py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === "courses"
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => {
              setActiveTab("courses")
              setSelectedCourse(null)
            }}
            disabled={loading.actions}
          >
            <BookOpen size={16} className="inline mr-2" />
            My Courses
          </button>
          {selectedCourse && (
            <>
              <button
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === "enrollments"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("enrollments")}
                disabled={loading.actions}
              >
                <Users size={16} className="inline mr-2" />
                Enrollments
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeTab === "materials"
                    ? "text-primary-600 border-b-2 border-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("materials")}
                disabled={loading.actions}
              >
                <FileText size={16} className="inline mr-2" />
                Study Materials
              </button>
            </>
          )}
        </div>

        {/* Courses Tab */}
        {activeTab === "courses" && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-700">Your Courses</h2>
              {!isCreating && !editingCourse && (
                <Button
                  variant="primary"
                  onClick={() => setIsCreating(true)}
                  className="flex items-center"
                  disabled={loading.actions}
                >
                  <Plus size={18} className="mr-1" />
                  Create Course
                </Button>
              )}
            </div>

            {/* Course Form */}
            {(isCreating || editingCourse) && (
              <div className="bg-white rounded-lg shadow-soft p-6 mb-6">
                <h3 className="text-lg font-medium text-gray-700 mb-4">
                  {editingCourse ? "Edit Course" : "Create New Course"}
                </h3>

                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Course Name"
                      placeholder="e.g., Introduction to Mathematics"
                      defaultValue={editingCourse?.name || ""}
                      {...register("name", { required: "Course name is required" })}
                      error={errors.name?.message}
                      disabled={loading.actions}
                    />

                    <Input
                      label="Grade Level"
                      placeholder="e.g., 9th Grade"
                      defaultValue={editingCourse?.gradeLevel || ""}
                      {...register("gradeLevel", { required: "Grade level is required" })}
                      error={errors.gradeLevel?.message}
                      disabled={loading.actions}
                    />

                    <Input
                      label="Subject"
                      placeholder="e.g., Mathematics"
                      defaultValue={editingCourse?.subject || ""}
                      {...register("subject", { required: "Subject is required" })}
                      error={errors.subject?.message}
                      disabled={loading.actions}
                    />

                    <Input
                      label="Schedule"
                      placeholder="e.g., Mon/Wed/Fri 10:00-11:30 AM"
                      defaultValue={editingCourse?.schedule || ""}
                      {...register("schedule", { required: "Schedule is required" })}
                      error={errors.schedule?.message}
                      disabled={loading.actions}
                    />

                    <Input
                      label="Location"
                      placeholder="e.g., Room 101"
                      defaultValue={editingCourse?.location || ""}
                      {...register("location", { required: "Location is required" })}
                      error={errors.location?.message}
                      disabled={loading.actions}
                    />

                    <Input
                      label="Prerequisites"
                      placeholder="e.g., Basic Algebra knowledge"
                      defaultValue={editingCourse?.prerequisites || ""}
                      {...register("prerequisites")}
                      disabled={loading.actions}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Description</label>
                    <textarea
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={4}
                      placeholder="Describe what students will learn in this course"
                      defaultValue={editingCourse?.description || ""}
                      {...register("description", { required: "Description is required" })}
                      disabled={loading.actions}
                    ></textarea>
                    {errors.description && <p className="mt-1 text-sm text-error-500">{errors.description.message}</p>}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Objectives</label>
                    <textarea
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={3}
                      placeholder="List the learning objectives for this course"
                      defaultValue={editingCourse?.objectives || ""}
                      {...register("objectives")}
                      disabled={loading.actions}
                    ></textarea>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Syllabus</label>
                    <textarea
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={5}
                      placeholder="Outline the course syllabus with topics and timeline"
                      defaultValue={editingCourse?.syllabus || ""}
                      {...register("syllabus")}
                      disabled={loading.actions}
                    ></textarea>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        reset()
                        setIsCreating(false)
                        setEditingCourse(null)
                      }}
                      className="mr-2"
                      disabled={loading.actions}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={loading.actions}>
                      {loading.actions ? "Saving..." : editingCourse ? "Update Course" : "Create Course"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Courses List */}
            {loading.courses ? (
              <div className="flex justify-center items-center h-64">
                <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading your courses...</span>
              </div>
            ) : courses.length === 0 ? (
              <div className="bg-white rounded-lg shadow-soft p-8 text-center">
                <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Courses Yet</h3>
                <p className="text-gray-500 mb-4">
                  You haven't created any courses yet. Get started by creating your first course.
                </p>
                {!isCreating && (
                  <Button
                    variant="primary"
                    onClick={() => setIsCreating(true)}
                    className="flex items-center mx-auto"
                    disabled={loading.actions}
                  >
                    <Plus size={18} className="mr-1" />
                    Create Your First Course
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white rounded-lg shadow-soft overflow-hidden transition-transform hover:shadow-md"
                  >
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">{course.name}</h3>
                      <p className="text-sm text-gray-500 mb-1">Grade Level: {course.gradeLevel}</p>
                      <p className="text-sm text-gray-500 mb-4">Subject: {course.subject || "N/A"}</p>
                      <p className="text-sm text-gray-600 mb-6 line-clamp-3">{course.description}</p>
                      <div className="flex justify-between">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingCourse(course)
                              setIsCreating(false)
                              reset({
                                name: course.name,
                                description: course.description,
                                gradeLevel: course.gradeLevel,
                                subject: course.subject || "",
                                schedule: course.schedule || "",
                                location: course.location || "",
                                syllabus: course.syllabus || "",
                                objectives: course.objectives || "",
                                prerequisites: course.prerequisites || "",
                              })
                            }}
                            className="text-gray-600 p-2"
                            disabled={loading.actions}
                          >
                            <Edit size={18} />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => deleteCourse(course.id)}
                            className="text-error-600 p-2"
                            disabled={loading.actions}
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                        <Button variant="primary" onClick={() => handleManageCourse(course)} disabled={loading.actions}>
                          {loading.enrollments && selectedCourse?.id === course.id ? "Loading..." : "Manage"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Enrollments Tab */}
        {activeTab === "enrollments" && selectedCourse && (
          <>
            <div className="mb-6">
              <button
                onClick={() => setActiveTab("courses")}
                className="flex items-center text-gray-600 hover:text-primary-600 mb-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Back to Courses
              </button>
              <h2 className="text-xl font-semibold text-gray-700">{selectedCourse.name} - Enrollments</h2>
              <p className="text-gray-500">{selectedCourse.gradeLevel}</p>
            </div>

            <div className="bg-white rounded-lg shadow-soft overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-700 mb-4">Student Enrollment Requests</h3>

                {loading.enrollments ? (
                  <div className="flex justify-center items-center py-6">
                    <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-600">Loading enrollments...</span>
                  </div>
                ) : enrollments.length === 0 ? (
                  <div className="text-center py-6">
                    <Users size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No enrollment requests yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Student
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Request Date
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Status
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {enrollments.map((enrollment) => (
                          <tr key={enrollment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {enrollment.studentName || "Unknown Student"}
                              </div>
                              <div className="text-sm text-gray-500">{enrollment.studentEmail}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {enrollment.createdAt ? new Date(enrollment.createdAt).toLocaleDateString() : "Unknown"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${
                                  enrollment.status === "approved"
                                    ? "bg-success-100 text-success-800"
                                    : enrollment.status === "rejected"
                                      ? "bg-error-100 text-error-800"
                                      : "bg-warning-100 text-warning-800"
                                }`}
                              >
                                {enrollment.status === "approved"
                                  ? "Approved"
                                  : enrollment.status === "rejected"
                                    ? "Rejected"
                                    : "Pending"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {enrollment.status === "pending" && (
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    onClick={() => updateEnrollmentStatus(enrollment.id, "approved")}
                                    className="text-success-600 p-2"
                                    disabled={loading.actions}
                                  >
                                    <Check size={18} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => updateEnrollmentStatus(enrollment.id, "rejected")}
                                    className="text-error-600 p-2"
                                    disabled={loading.actions}
                                  >
                                    <X size={18} />
                                  </Button>
                                </div>
                              )}
                              {enrollment.status !== "pending" && <span className="text-gray-500">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Study Materials Tab */}
        {activeTab === "materials" && selectedCourse && (
          <>
            <div className="mb-6">
              <button
                onClick={() => setActiveTab("courses")}
                className="flex items-center text-gray-600 hover:text-primary-600 mb-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Back to Courses
              </button>
              <h2 className="text-xl font-semibold text-gray-700">{selectedCourse.name} - Study Materials</h2>
              <p className="text-gray-500">{selectedCourse.gradeLevel}</p>
            </div>

            <div className="bg-white rounded-lg shadow-soft overflow-hidden mb-6">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-700">Course Resources</h3>
                  <div className="flex space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      multiple
                    />
                    <input
                      type="file"
                      ref={importInputRef}
                      onChange={handleImportMaterials}
                      accept=".zip"
                      className="hidden"
                    />
                    <Button
                      variant="primary"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center"
                      disabled={loading.fileUpload}
                    >
                      <Upload size={18} className="mr-1" />
                      {loading.fileUpload ? "Uploading..." : "Upload Materials"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => importInputRef.current?.click()}
                      className="flex items-center"
                      disabled={loading.importLoading}
                    >
                      <FileInput size={18} className="mr-1" />
                      {loading.importLoading ? "Importing..." : "Import ZIP"}
                    </Button>
                    {materials.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={exportMaterialsAsZip}
                        className="flex items-center"
                        disabled={loading.exportLoading}
                      >
                        <FileArchive size={18} className="mr-1" />
                        {loading.exportLoading ? "Preparing..." : "Export All"}
                      </Button>
                    )}
                  </div>
                </div>

                {loading.materials ? (
                  <div className="flex justify-center items-center py-6">
                    <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-600">Loading materials...</span>
                  </div>
                ) : materials.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No study materials uploaded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {materials.map((material) => (
                      <div
                        key={material.id}
                        className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center">
                          <File className="text-gray-500 mr-3" size={20} />
                          <div>
                            <p className="font-medium text-gray-800">{material.name}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(material.createdAt).toLocaleDateString()} •{" "}
                              {Math.round(material.size / 1024)} KB •{" "}
                              {material.type.split('/')[1] || material.type.split('.')[1] || "file"}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <a
                            href={material.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-primary-600 hover:text-primary-800"
                          >
                            <Download size={18} />
                          </a>
                          <Button
                            variant="ghost"
                            onClick={() => deleteMaterial(material.id, material.fileUrl)}
                            className="text-error-600 p-2"
                            disabled={loading.actions}
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Course Information Section */}
            <div className="bg-white rounded-lg shadow-soft overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-700 mb-4">Course Information</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-md font-semibold text-gray-700 mb-2">Description</h4>
                    <p className="text-gray-600 whitespace-pre-line">
                      {selectedCourse.description || "No description provided."}
                    </p>
                  </div>

                  {selectedCourse.objectives && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-700 mb-2">Learning Objectives</h4>
                      <ul className="list-disc pl-5 text-gray-600 space-y-1">
                        {selectedCourse.objectives.split('\n').map((obj, index) => (
                          <li key={index}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCourse.syllabus && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-700 mb-2">Course Syllabus</h4>
                      <div className="prose max-w-none text-gray-600 whitespace-pre-line">
                        {selectedCourse.syllabus}
                      </div>
                    </div>
                  )}

                  {selectedCourse.prerequisites && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-700 mb-2">Prerequisites</h4>
                      <p className="text-gray-600 whitespace-pre-line">{selectedCourse.prerequisites}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

export default CourseDetails