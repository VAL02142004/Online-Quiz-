"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { db } from "../../firebase/config"
import { useAuth } from "../../context/AuthContext"
import DashboardLayout from "../../components/layout/DashboardLayout"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import { Plus, Trash2, FilePlus, Save, Eye, Clock, BookOpen, Edit, X, Users, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"

const questionTypes = [
  { value: "multiple-choice-single", label: "Multiple Choice (Single Answer)" },
  { value: "multiple-choice-multiple", label: "Multiple Choice (Multiple Answers)" },
  { value: "true-false", label: "True/False" },
  { value: "short-answer", label: "Short Answer" },
  { value: "essay", label: "Essay/Long Answer" },
  { value: "fill-blank", label: "Fill in the Blank" },
  { value: "matching", label: "Matching" },
  { value: "ordering", label: "Ordering/Sequencing" },
]

const CreateQuiz = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()
  const { currentUser } = useAuth()
  const [courses, setCourses] = useState([])
  const [questions, setQuestions] = useState([
    { 
      type: "multiple-choice-single",
      text: "", 
      options: ["", "", "", ""], 
      correctAnswers: [0],
      matches: [],
      ordering: [],
      blanks: []
    }
  ])
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState("")
  const [createdQuizzes, setCreatedQuizzes] = useState([])
  const [activeTab, setActiveTab] = useState("create")
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [deletingQuiz, setDeletingQuiz] = useState(null)
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const [enableTimer, setEnableTimer] = useState(true)
  const [preventNavigation, setPreventNavigation] = useState(true)

  // Fetch courses taught by the teacher and existing quizzes
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return

      try {
        // Fetch courses
        const coursesQuery = query(collection(db, "courses"), where("teacherId", "==", currentUser.uid))
        const coursesSnapshot = await getDocs(coursesQuery)
        const coursesData = coursesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setCourses(coursesData)

        // Set the first course as selected by default
        if (coursesData.length > 0 && !selectedCourse) {
          setSelectedCourse(coursesData[0].id)
        }

        // Fetch quizzes created by this teacher
        const quizzesQuery = query(collection(db, "quizzes"), where("teacherId", "==", currentUser.uid))
        const quizzesSnapshot = await getDocs(quizzesQuery)
        const quizzesData = quizzesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setCreatedQuizzes(quizzesData)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast.error("Failed to load data")
      }
    }

    fetchData()
  }, [currentUser])

  // Update existing quiz to include enrolled students
  const updateQuizEnrollment = async (quizId) => {
    try {
      const quiz = createdQuizzes.find((q) => q.id === quizId)
      if (!quiz) return

      // Get enrolled students for this course
      const enrollmentsQuery = query(
        collection(db, "enrollments"),
        where("courseId", "==", quiz.courseId),
        where("status", "==", "approved"),
      )
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery)
      const enrolledStudents = enrollmentsSnapshot.docs.map((doc) => doc.data().studentId)

      // Update quiz with enrolled students
      const quizRef = doc(db, "quizzes", quizId)
      await updateDoc(quizRef, {
        enrolledStudents: enrolledStudents,
        updatedAt: new Date().toISOString(),
      })

      // Update local state
      setCreatedQuizzes((prev) => prev.map((q) => (q.id === quizId ? { ...q, enrolledStudents: enrolledStudents } : q)))

      toast.success(`Quiz updated with ${enrolledStudents.length} enrolled students!`)
    } catch (error) {
      console.error("Error updating quiz enrollment:", error)
      toast.error("Failed to update quiz enrollment")
    }
  }

  // Handle question changes
  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...questions]

    if (field === "text") {
      updatedQuestions[index].text = value
    } else if (field === "type") {
      updatedQuestions[index].type = value
      // Reset options when type changes
      if (value === "multiple-choice-single" || value === "multiple-choice-multiple") {
        updatedQuestions[index].options = ["", "", "", ""]
        updatedQuestions[index].correctAnswers = value === "multiple-choice-single" ? [0] : []
      } else if (value === "true-false") {
        updatedQuestions[index].options = ["True", "False"]
        updatedQuestions[index].correctAnswers = [0]
      } else if (value === "fill-blank") {
        updatedQuestions[index].blanks = [""]
      } else if (value === "matching") {
        updatedQuestions[index].matches = [{ left: "", right: "" }]
      } else if (value === "ordering") {
        updatedQuestions[index].ordering = ["", ""]
      } else {
        updatedQuestions[index].options = []
        updatedQuestions[index].correctAnswers = []
      }
    } else if (field.startsWith("option")) {
      const optionIndex = Number.parseInt(field.replace("option", ""), 10)
      updatedQuestions[index].options[optionIndex] = value
    } else if (field.startsWith("correctAnswer")) {
      const answerIndex = Number.parseInt(field.replace("correctAnswer", ""), 10)
      const currentAnswers = updatedQuestions[index].correctAnswers
      
      if (updatedQuestions[index].type === "multiple-choice-single") {
        updatedQuestions[index].correctAnswers = [answerIndex]
      } else {
        if (currentAnswers.includes(answerIndex)) {
          updatedQuestions[index].correctAnswers = currentAnswers.filter(a => a !== answerIndex)
        } else {
          updatedQuestions[index].correctAnswers = [...currentAnswers, answerIndex]
        }
      }
    } else if (field.startsWith("blank")) {
      const blankIndex = Number.parseInt(field.replace("blank", ""), 10)
      updatedQuestions[index].blanks[blankIndex] = value
    } else if (field.startsWith("matchLeft")) {
      const matchIndex = Number.parseInt(field.replace("matchLeft", ""), 10)
      updatedQuestions[index].matches[matchIndex].left = value
    } else if (field.startsWith("matchRight")) {
      const matchIndex = Number.parseInt(field.replace("matchRight", ""), 10)
      updatedQuestions[index].matches[matchIndex].right = value
    } else if (field.startsWith("orderItem")) {
      const orderIndex = Number.parseInt(field.replace("orderItem", ""), 10)
      updatedQuestions[index].ordering[orderIndex] = value
    }

    setQuestions(updatedQuestions)
  }

  // Add a new question
  const addQuestion = () => {
    setQuestions([
      ...questions, 
      { 
        type: "multiple-choice-single",
        text: "", 
        options: ["", "", "", ""], 
        correctAnswers: [0],
        matches: [],
        ordering: [],
        blanks: []
      }
    ])
  }

  // Remove a question
  const removeQuestion = (index) => {
    if (questions.length <= 1) {
      toast.error("At least one question is required")
      return
    }

    const updatedQuestions = [...questions]
    updatedQuestions.splice(index, 1)
    setQuestions(updatedQuestions)
  }

  // Add option to question
  const addOption = (qIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].options.push("")
    setQuestions(updatedQuestions)
  }

  // Remove option from question
  const removeOption = (qIndex, oIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].options.splice(oIndex, 1)
    
    // Adjust correct answers if needed
    updatedQuestions[qIndex].correctAnswers = updatedQuestions[qIndex].correctAnswers
      .map(a => a >= oIndex ? a - 1 : a)
      .filter(a => a < updatedQuestions[qIndex].options.length)
    
    setQuestions(updatedQuestions)
  }

  // Add blank to fill-in-the-blank question
  const addBlank = (qIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].blanks.push("")
    setQuestions(updatedQuestions)
  }

  // Remove blank from fill-in-the-blank question
  const removeBlank = (qIndex, bIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].blanks.splice(bIndex, 1)
    setQuestions(updatedQuestions)
  }

  // Add match to matching question
  const addMatch = (qIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].matches.push({ left: "", right: "" })
    setQuestions(updatedQuestions)
  }

  // Remove match from matching question
  const removeMatch = (qIndex, mIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].matches.splice(mIndex, 1)
    setQuestions(updatedQuestions)
  }

  // Add item to ordering question
  const addOrderItem = (qIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].ordering.push("")
    setQuestions(updatedQuestions)
  }

  // Remove item from ordering question
  const removeOrderItem = (qIndex, oIndex) => {
    const updatedQuestions = [...questions]
    updatedQuestions[qIndex].ordering.splice(oIndex, 1)
    setQuestions(updatedQuestions)
  }

  // Move question up
  const moveQuestionUp = (index) => {
    if (index <= 0) return
    const updatedQuestions = [...questions]
    const temp = updatedQuestions[index]
    updatedQuestions[index] = updatedQuestions[index - 1]
    updatedQuestions[index - 1] = temp
    setQuestions(updatedQuestions)
  }

  // Move question down
  const moveQuestionDown = (index) => {
    if (index >= questions.length - 1) return
    const updatedQuestions = [...questions]
    const temp = updatedQuestions[index]
    updatedQuestions[index] = updatedQuestions[index + 1]
    updatedQuestions[index + 1] = temp
    setQuestions(updatedQuestions)
  }

  // Start editing a quiz
  const startEditingQuiz = (quiz) => {
    setEditingQuiz(quiz)
    setActiveTab("create")
    setSelectedCourse(quiz.courseId)
    setQuestions(quiz.questions || [
      { 
        type: "multiple-choice-single",
        text: "", 
        options: ["", "", "", ""], 
        correctAnswers: [0],
        matches: [],
        ordering: [],
        blanks: []
      }
    ])
    setShuffleQuestions(quiz.shuffleQuestions || true)
    setShuffleOptions(quiz.shuffleOptions || true)
    setEnableTimer(quiz.enableTimer !== undefined ? quiz.enableTimer : true)
    setPreventNavigation(quiz.preventNavigation !== undefined ? quiz.preventNavigation : true)

    // Reset form with quiz data
    reset({
      title: quiz.title,
      description: quiz.description || "",
      dueDate: quiz.dueDate ? quiz.dueDate.split("T")[0] : "",
      timeLimit: quiz.timeLimit || "",
    })
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingQuiz(null)
    reset()
    setQuestions([
      { 
        type: "multiple-choice-single",
        text: "", 
        options: ["", "", "", ""], 
        correctAnswers: [0],
        matches: [],
        ordering: [],
        blanks: []
      }
    ])
    setSelectedCourse(courses.length > 0 ? courses[0].id : "")
    setShuffleQuestions(true)
    setShuffleOptions(true)
    setEnableTimer(true)
    setPreventNavigation(true)
  }

  // Delete quiz
  const deleteQuiz = async (quizId) => {
    if (!quizId) return

    setDeletingQuiz(quizId)

    try {
      await deleteDoc(doc(db, "quizzes", quizId))

      // Remove from local state
      setCreatedQuizzes((prev) => prev.filter((quiz) => quiz.id !== quizId))

      toast.success("Quiz deleted successfully!")
    } catch (error) {
      console.error("Error deleting quiz:", error)
      toast.error("Failed to delete quiz")
    } finally {
      setDeletingQuiz(null)
    }
  }

  // Handle form submission (create or update)
  const onSubmit = async (data) => {
    if (!selectedCourse) {
      toast.error("Please select a course")
      return
    }

    // Validate questions
    const invalidQuestions = questions.some((question) => {
      if (!question.text.trim()) return true
      
      switch (question.type) {
        case "multiple-choice-single":
        case "multiple-choice-multiple":
          return question.options.some(opt => !opt.trim()) || question.correctAnswers.length === 0
        case "true-false":
          return question.correctAnswers.length === 0
        case "fill-blank":
          return question.blanks.some(blank => !blank.trim())
        case "matching":
          return question.matches.some(match => !match.left.trim() || !match.right.trim())
        case "ordering":
          return question.ordering.some(item => !item.trim())
        default:
          return false
      }
    })

    if (invalidQuestions) {
      toast.error("All questions must be properly filled out")
      return
    }

    setLoading(true)

    try {
      // Find the selected course
      const selectedCourseData = courses.find((course) => course.id === selectedCourse)

      // Get enrolled students for this course
      const enrollmentsQuery = query(
        collection(db, "enrollments"),
        where("courseId", "==", selectedCourse),
        where("status", "==", "approved"),
      )
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery)
      const enrolledStudents = enrollmentsSnapshot.docs.map((doc) => doc.data().studentId)

      // Create quiz document
      const quizData = {
        title: data.title,
        description: data.description,
        courseId: selectedCourse,
        courseName: selectedCourseData?.name || "Unknown Course",
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || currentUser.email,
        questions: questions.map((question) => ({
          type: question.type,
          text: question.text,
          options: question.options,
          correctAnswers: question.correctAnswers,
          matches: question.matches,
          ordering: question.ordering,
          blanks: question.blanks
        })),
        dueDate: data.dueDate || null,
        timeLimit: data.timeLimit ? Number.parseInt(data.timeLimit) : null,
        isPublished: true,
        enrolledStudents: enrolledStudents,
        shuffleQuestions: shuffleQuestions,
        shuffleOptions: shuffleOptions,
        enableTimer: enableTimer,
        preventNavigation: preventNavigation,
      }

      if (editingQuiz) {
        // Update existing quiz
        quizData.updatedAt = new Date().toISOString()
        await updateDoc(doc(db, "quizzes", editingQuiz.id), quizData)

        // Update local state
        setCreatedQuizzes((prev) =>
          prev.map((quiz) =>
            quiz.id === editingQuiz.id ? { id: editingQuiz.id, ...quizData, createdAt: quiz.createdAt } : quiz,
          ),
        )

        toast.success("Quiz updated successfully!")
        setEditingQuiz(null)
      } else {
        // Create new quiz
        quizData.createdAt = new Date().toISOString()
        const docRef = await addDoc(collection(db, "quizzes"), quizData)

        // Add the new quiz to the createdQuizzes state
        setCreatedQuizzes((prev) => [
          {
            id: docRef.id,
            ...quizData,
          },
          ...prev,
        ])

        toast.success(`Quiz created successfully with ${enrolledStudents.length} enrolled students!`)
      }

      // Reset form
      reset()
      setQuestions([
        { 
          type: "multiple-choice-single",
          text: "", 
          options: ["", "", "", ""], 
          correctAnswers: [0],
          matches: [],
          ordering: [],
          blanks: []
        }
      ])
      setSelectedCourse(courses.length > 0 ? courses[0].id : "")
      setShuffleQuestions(true)
      setShuffleOptions(true)
      setEnableTimer(true)
      setPreventNavigation(true)
    } catch (error) {
      console.error("Error saving quiz:", error)
      toast.error(`Failed to ${editingQuiz ? "update" : "create"} quiz`)
    } finally {
      setLoading(false)
    }
  }

  // Render question input based on type
  const renderQuestionInput = (question, qIndex) => {
    switch (question.type) {
      case "multiple-choice-single":
      case "multiple-choice-multiple":
        return (
          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">Answer Options</p>
            {question.options.map((option, oIndex) => (
              <div key={oIndex} className="flex items-center mb-2">
                <input
                  type={question.type === "multiple-choice-single" ? "radio" : "checkbox"}
                  name={`question-${qIndex}-correct`}
                  id={`question-${qIndex}-option-${oIndex}`}
                  checked={question.correctAnswers.includes(oIndex)}
                  onChange={() => handleQuestionChange(qIndex, `correctAnswer${oIndex}`, oIndex)}
                  className="mr-2"
                />
                <div className="flex-1 flex items-center">
                  <Input
                    placeholder={`Option ${oIndex + 1}`}
                    value={option}
                    onChange={(e) => handleQuestionChange(qIndex, `option${oIndex}`, e.target.value)}
                    className="flex-1 mr-2"
                  />
                  {question.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(qIndex, oIndex)}
                      className="text-error-600 hover:text-error-800 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addOption(qIndex)}
              className="mt-2"
            >
              <Plus size={14} className="mr-1" />
              Add Option
            </Button>
          </div>
        )
      case "true-false":
        return (
          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">Select Correct Answer</p>
            {question.options.map((option, oIndex) => (
              <div key={oIndex} className="flex items-center mb-2">
                <input
                  type="radio"
                  name={`question-${qIndex}-correct`}
                  id={`question-${qIndex}-option-${oIndex}`}
                  checked={question.correctAnswers.includes(oIndex)}
                  onChange={() => handleQuestionChange(qIndex, `correctAnswer${oIndex}`, oIndex)}
                  className="mr-2"
                />
                <label htmlFor={`question-${qIndex}-option-${oIndex}`} className="text-gray-700">
                  {option}
                </label>
              </div>
            ))}
          </div>
        )
      case "short-answer":
      case "essay":
        return (
          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">
              {question.type === "short-answer" ? "Short Answer" : "Essay Answer"} (Student will type their response)
            </p>
            <div className="bg-gray-100 p-3 rounded text-sm text-gray-600">
              This question type will require manual grading by the instructor.
            </div>
          </div>
        )
      case "fill-blank":
        return (
          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">Fill in the Blank Answers</p>
            {question.blanks.map((blank, bIndex) => (
              <div key={bIndex} className="flex items-center mb-2">
                <Input
                  placeholder={`Blank ${bIndex + 1}`}
                  value={blank}
                  onChange={(e) => handleQuestionChange(qIndex, `blank${bIndex}`, e.target.value)}
                  className="flex-1 mr-2"
                />
                {question.blanks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlank(qIndex, bIndex)}
                    className="text-error-600 hover:text-error-800 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addBlank(qIndex)}
              className="mt-2"
            >
              <Plus size={14} className="mr-1" />
              Add Blank
            </Button>
            <div className="mt-3 text-sm text-gray-600">
              <p>In your question text, use underscores to indicate blanks (e.g., "The capital of France is _____").</p>
            </div>
          </div>
        )
      case "matching":
        return (
          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">Matching Pairs</p>
            {question.matches.map((match, mIndex) => (
              <div key={mIndex} className="grid grid-cols-2 gap-2 mb-2">
                <Input
                  placeholder={`Left item ${mIndex + 1}`}
                  value={match.left}
                  onChange={(e) => handleQuestionChange(qIndex, `matchLeft${mIndex}`, e.target.value)}
                />
                <div className="flex items-center">
                  <Input
                    placeholder={`Right item ${mIndex + 1}`}
                    value={match.right}
                    onChange={(e) => handleQuestionChange(qIndex, `matchRight${mIndex}`, e.target.value)}
                    className="flex-1 mr-2"
                  />
                  {question.matches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMatch(qIndex, mIndex)}
                      className="text-error-600 hover:text-error-800 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addMatch(qIndex)}
              className="mt-2"
            >
              <Plus size={14} className="mr-1" />
              Add Pair
            </Button>
          </div>
        )
      case "ordering":
        return (
          <div className="mb-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">Items to Order</p>
            {question.ordering.map((item, oIndex) => (
              <div key={oIndex} className="flex items-center mb-2">
                <span className="mr-2 text-sm text-gray-500">{oIndex + 1}.</span>
                <Input
                  placeholder={`Item ${oIndex + 1}`}
                  value={item}
                  onChange={(e) => handleQuestionChange(qIndex, `orderItem${oIndex}`, e.target.value)}
                  className="flex-1 mr-2"
                />
                {question.ordering.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOrderItem(qIndex, oIndex)}
                    className="text-error-600 hover:text-error-800 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addOrderItem(qIndex)}
              className="mt-2"
            >
              <Plus size={14} className="mr-1" />
              Add Item
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <DashboardLayout title="Manage Quizzes">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-soft p-6 animate-fade-in">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-2 px-4 font-medium ${activeTab === "create" ? "text-primary-600 border-b-2 border-primary-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("create")}
          >
            {editingQuiz ? "Edit Quiz" : "Create New Quiz"}
          </button>
          <button
            className={`py-2 px-4 font-medium ${activeTab === "view" ? "text-primary-600 border-b-2 border-primary-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("view")}
          >
            My Quizzes ({createdQuizzes.length})
          </button>
        </div>

        {activeTab === "create" ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <FilePlus size={24} className="text-primary-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-800">{editingQuiz ? "Edit Quiz" : "Create New Quiz"}</h2>
              </div>
              {editingQuiz && (
                <Button type="button" variant="outline" onClick={cancelEditing} className="flex items-center">
                  <X size={18} className="mr-1" />
                  Cancel Edit
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Input
                  label="Quiz Title"
                  placeholder="Introduction to Mathematics"
                  {...register("title", { required: "Quiz title is required" })}
                  error={errors.title?.message}
                />

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Course</label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                  >
                    <option value="" disabled>
                      Select a course
                    </option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name || "Untitled Course"}
                      </option>
                    ))}
                  </select>
                  {courses.length === 0 && (
                    <p className="mt-1 text-sm text-warning-600">No courses found. Please create a course first.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Input
                  label="Quiz Description (Optional)"
                  placeholder="This quiz covers the basics of algebra and geometry"
                  {...register("description")}
                />

                <Input
                  label="Time Limit (minutes)"
                  type="number"
                  placeholder="30"
                  {...register("timeLimit")}
                  min="1"
                  max="180"
                />
              </div>

              <div className="mb-6">
                <Input label="Due Date (Optional)" type="date" {...register("dueDate")} />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-medium text-gray-700 mb-4">Quiz Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="shuffleQuestions"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="shuffleQuestions" className="ml-2 block text-sm text-gray-700">
                      Shuffle Questions for Each Student
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="shuffleOptions"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="shuffleOptions" className="ml-2 block text-sm text-gray-700">
                      Shuffle Answer Options for Each Student
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableTimer"
                      checked={enableTimer}
                      onChange={(e) => setEnableTimer(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enableTimer" className="ml-2 block text-sm text-gray-700">
                      Enable Timer
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="preventNavigation"
                      checked={preventNavigation}
                      onChange={(e) => setPreventNavigation(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="preventNavigation" className="ml-2 block text-sm text-gray-700">
                      Prevent Navigation During Quiz
                    </label>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-700">Quiz Questions</h3>
                  <Button type="button" variant="outline" onClick={addQuestion} className="flex items-center">
                    <Plus size={18} className="mr-1" />
                    Add Question
                  </Button>
                </div>

                {questions.map((question, qIndex) => (
                  <div key={qIndex} className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <h4 className="text-md font-medium text-gray-700 mr-3">Question {qIndex + 1}</h4>
                        <div className="flex space-x-1">
                          <button
                            type="button"
                            onClick={() => moveQuestionUp(qIndex)}
                            className="text-gray-500 hover:text-primary-600 p-1"
                            disabled={qIndex === 0}
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestionDown(qIndex)}
                            className="text-gray-500 hover:text-primary-600 p-1"
                            disabled={qIndex === questions.length - 1}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <select
                          value={question.type}
                          onChange={(e) => handleQuestionChange(qIndex, "type", e.target.value)}
                          className="mr-2 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {questionTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIndex)}
                          className="text-error-600 hover:text-error-800"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <Input
                        label="Question Text"
                        placeholder={
                          question.type === "fill-blank" 
                            ? "The capital of France is _____" 
                            : question.type === "essay" 
                              ? "Explain the main themes in Shakespeare's Macbeth"
                              : "What is 2 + 2?"
                        }
                        value={question.text}
                        onChange={(e) => handleQuestionChange(qIndex, "text", e.target.value)}
                      />
                    </div>

                    {renderQuestionInput(question, qIndex)}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="flex items-center"
                  disabled={loading || courses.length === 0}
                >
                  {loading ? (
                    <>{editingQuiz ? "Updating..." : "Creating..."}</>
                  ) : (
                    <>
                      <Save size={18} className="mr-2" />
                      {editingQuiz ? "Update Quiz" : "Create Quiz"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div>
            <div className="flex items-center mb-6">
              <Eye size={24} className="text-primary-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-800">My Created Quizzes</h2>
            </div>

            {createdQuizzes.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">You haven't created any quizzes yet.</p>
                <Button variant="primary" onClick={() => setActiveTab("create")} className="flex items-center mx-auto">
                  <Plus size={18} className="mr-1" />
                  Create Your First Quiz
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {createdQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-800 flex-1 mr-2">{quiz.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${quiz.isPublished ? "bg-success-100 text-success-800" : "bg-warning-100 text-warning-800"}`}
                      >
                        {quiz.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{quiz.description || "No description"}</p>

                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <BookOpen size={14} className="mr-1" />
                      <span className="truncate">{quiz.courseName}</span>
                    </div>

                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <Users size={14} className="mr-1" />
                      <span>{quiz.enrolledStudents?.length || 0} enrolled students</span>
                    </div>

                    {quiz.timeLimit && (
                      <div className="flex items-center text-sm text-gray-500 mb-2">
                        <Clock size={14} className="mr-1" />
                        <span>{quiz.timeLimit} minutes</span>
                      </div>
                    )}

                    {quiz.dueDate && (
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <Clock size={14} className="mr-1" />
                        <span>Due: {new Date(quiz.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-sm mb-4">
                      <span className="text-gray-500">{quiz.questions?.length || 0} questions</span>
                      <span className="text-gray-500">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Quiz Settings Indicators */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {quiz.shuffleQuestions && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Shuffle Qs</span>
                      )}
                      {quiz.shuffleOptions && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Shuffle Options</span>
                      )}
                      {quiz.enableTimer && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Timer</span>
                      )}
                      {quiz.preventNavigation && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Locked</span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 pt-3 border-t border-gray-200">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingQuiz(quiz)}
                          className="flex-1 flex items-center justify-center"
                          disabled={loading}
                        >
                          <Edit size={14} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuizEnrollment(quiz.id)}
                          className="flex-1 flex items-center justify-center"
                          disabled={loading}
                        >
                          <RefreshCw size={14} className="mr-1" />
                          Update Students
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            window.confirm("Are you sure you want to delete this quiz? This action cannot be undone.")
                          ) {
                            deleteQuiz(quiz.id)
                          }
                        }}
                        className="w-full flex items-center justify-center text-error-600 hover:text-error-800 border-error-200 hover:border-error-300"
                        disabled={deletingQuiz === quiz.id}
                      >
                        {deletingQuiz === quiz.id ? (
                          <>Deleting...</>
                        ) : (
                          <>
                            <Trash2 size={14} className="mr-1" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default CreateQuiz