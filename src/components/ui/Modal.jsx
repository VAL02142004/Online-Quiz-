import { useEffect } from "react"
import { X } from "lucide-react"

const Modal = ({ isOpen, onClose, title, children, icon }) => {
  // Close modal when pressing Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden" // Prevent scrolling
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "auto" // Re-enable scrolling
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>

      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          {/* Modal header */}
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {icon && <div className="mt-1">{icon}</div>}
                <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                onClick={onClose}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal content */}
          <div className="px-4 py-3 sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default Modal