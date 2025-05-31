import { useState, useEffect, useCallback } from "react";

export default function App() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [savedBooks, setSavedBooks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [db, setDb] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingBookId, setEditingBookId] = useState(null);
  const [newBookTitle, setNewBookTitle] = useState("");

  const ADMIN_PASSWORD = "truyenaidichdayA@";

  // Mock featured books
  const featuredBooks = [
    {
      id: 1,
      title: "Thế Giới Huyền Bí",
      author: "Nguyễn Văn A",
      genre: "Phiêu Lưu",
      cover: "https://picsum.photos/200/300",
    },
    {
      id: 2,
      title: "Chiến Binh Ánh Sáng",
      author: "Trần Thị B",
      genre: "Khoa Học",
      cover: "https://picsum.photos/201/301",
    },
    {
      id: 3,
      title: "Tình Yêu Vượt Thời Gian",
      author: "Phạm Văn C",
      genre: "Tình Cảm",
      cover: "https://picsum.photos/202/302",
    },
  ];

  // Initialize IndexedDB
  useEffect(() => {
    const request = indexedDB.open("TruyenAIDichDB", 2);
    request.onerror = () => console.error("Không thể mở cơ sở dữ liệu");
    request.onsuccess = (event) => {
      const database = event.target.result;
      setDb(database);
      loadBooksFromIndexedDB(database);
      loadSavedBooksFromIndexedDB(database);
    };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains("uploadedBooks")) {
        const bookStore = database.createObjectStore("uploadedBooks", { keyPath: "id" });
        bookStore.createIndex("id", "id", { unique: true });
      }
      if (!database.objectStoreNames.contains("savedBooks")) {
        const savedStore = database.createObjectStore("savedBooks", { keyPath: "id" });
        savedStore.createIndex("id", "id", { unique: true });
      }
    };
  }, [loadBooksFromIndexedDB, loadSavedBooksFromIndexedDB]); // Added dependencies

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update selected chapter and save reading position
  useEffect(() => {
    if (selectedBook) {
      setSelectedChapter(selectedBook.chapters[currentChapterIndex]);
      localStorage.setItem(
        `readingPosition_${selectedBook.id}`,
        currentChapterIndex
      );
    }
  }, [currentChapterIndex, selectedBook]);

  // Load reading position when selecting a book
  useEffect(() => {
    if (selectedBook) {
      const savedIndex = localStorage.getItem(`readingPosition_${selectedBook.id}`);
      if (savedIndex && selectedBook.chapters[savedIndex]) {
        setCurrentChapterIndex(parseInt(savedIndex, 10));
      }
    }
  }, [selectedBook]);

  const loadBooksFromIndexedDB = useCallback((database) => {
    const transaction = database.transaction(["uploadedBooks"], "readonly");
    const store = transaction.objectStore("uploadedBooks");
    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = (event) => {
      setBooks(event.target.result || []);
    };
  }, []);

  const loadSavedBooksFromIndexedDB = useCallback((database) => {
    const transaction = database.transaction(["savedBooks"], "readonly");
    const store = transaction.objectStore("savedBooks");
    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = (event) => {
      setSavedBooks(event.target.result.map((item) => item.id));
    };
  }, []);

  const saveBookToIndexedDB = useCallback((book) => {
    if (!db) return;
    const transaction = db.transaction(["uploadedBooks"], "readwrite");
    const store = transaction.objectStore("uploadedBooks");
    store.put(book);
  }, [db]);

  const saveSavedBookToIndexedDB = useCallback((bookId) => {
    if (!db) return;
    const transaction = db.transaction(["savedBooks"], "readwrite");
    const store = transaction.objectStore("savedBooks");
    store.put({ id: bookId });
  }, [db]);

  const removeSavedBookFromIndexedDB = useCallback((bookId) => {
    if (!db) return;
    const transaction = db.transaction(["savedBooks"], "readwrite");
    const store = transaction.objectStore("savedBooks");
    store.delete(bookId);
  }, [db]);

  const deleteBookFromIndexedDB = useCallback((bookId) => {
    if (!db) return;
    const transaction = db.transaction(["uploadedBooks"], "readwrite");
    const store = transaction.objectStore("uploadedBooks");
    store.delete(bookId);
  }, [db]);

  const readFileContent = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error(`Lỗi đọc file: ${e.target.error}`));
      reader.readAsText(file, "UTF-8");
    });
  }, []);

  const handleDirectoryUpload = useCallback(async (event) => {
    if (isOffline) {
      alert("Không thể tải lên khi đang ở chế độ offline");
      return;
    }
    setUploading(true);
    const files = Array.from(event.target.files);
    const txtFiles = files
      .filter((file) => file.name.toLowerCase().endsWith(".txt"))
      .sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });
    if (txtFiles.length === 0) {
      setUploading(false);
      alert("Không tìm thấy file .txt trong thư mục");
      return;
    }
    const newBook = {
      id: Date.now(),
      title: "Truyện Tải Lên",
      author: "Tác Giả Chưa Biết",
      genre: "truyện dịch tự động",
      chapters: [],
    };
    for (const file of txtFiles) {
      try {
        const content = await readFileContent(file);
        newBook.chapters.push({
          id: newBook.chapters.length + 1,
          title: `Chương ${newBook.chapters.length + 1}: ${file.name.replace(".txt", "")}`,
          content,
        });
      } catch (error) {
        console.error(`Lỗi đọc file ${file.name}:`, error);
        alert(`Không thể đọc file ${file.name}. Vui lòng kiểm tra định dạng hoặc mã hóa file.`);
      }
    }
    saveBookToIndexedDB(newBook);
    setBooks([...books, newBook]);
    setSelectedBook(newBook);
    setUploading(false);
    alert(`Đã tải lên thành công ${newBook.chapters.length} chương`);
  }, [books, isOffline, readFileContent, saveBookToIndexedDB]); // Added dependencies

  const handleSaveBook = useCallback(() => {
    if (!selectedBook) return;
    if (savedBooks.includes(selectedBook.id)) {
      alert("Truyện này đã được lưu!");
      return;
    }
    if (db) {
      saveSavedBookToIndexedDB(selectedBook.id);
      setSavedBooks([...savedBooks, selectedBook.id]);
      alert("Đã lưu toàn bộ truyện offline thành công!");
    } else {
      alert("Không thể lưu truyện do không hỗ trợ IndexedDB.");
    }
  }, [db, savedBooks, selectedBook, saveSavedBookToIndexedDB]);

  const handleShowDeleteModal = useCallback((bookId) => {
    setDeleteTargetId(bookId);
    setShowPasswordModal(true);
    setPasswordInput("");
    setPasswordError("");
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (passwordInput === ADMIN_PASSWORD) {
      removeSavedBookFromIndexedDB(deleteTargetId);
      deleteBookFromIndexedDB(deleteTargetId);
      setSavedBooks(savedBooks.filter((id) => id !== deleteTargetId));
      setBooks(books.filter((book) => book.id !== deleteTargetId));
      if (selectedBook?.id === deleteTargetId) {
        setSelectedBook(null);
        setSelectedChapter(null);
      }
      setShowPasswordModal(false);
      setPasswordError("");
    } else {
      setPasswordError("Mật khẩu không chính xác");
    }
  }, [
    passwordInput,
    deleteTargetId,
    selectedBook,
    savedBooks,
    books,
    removeSavedBookFromIndexedDB,
    deleteBookFromIndexedDB,
  ]);

  const handleEditBookTitle = useCallback((bookId, currentTitle) => {
    setEditingBookId(bookId);
    setNewBookTitle(currentTitle);
  }, []);

  const handleSaveBookTitle = useCallback(() => {
    if (!newBookTitle.trim()) {
      alert("Tên truyện không được để trống");
      return;
    }
    const updatedBooks = books.map((book) =>
      book.id === editingBookId ? { ...book, title: newBookTitle } : book
    );
    setBooks(updatedBooks);
    saveBookToIndexedDB(updatedBooks.find((b) => b.id === editingBookId));
    setEditingBookId(null);
    setNewBookTitle("");
  }, [books, editingBookId, newBookTitle, saveBookToIndexedDB]);

  const increaseFont = useCallback(() => setFontSize((prev) => Math.min(prev + 2, 24)), []);
  const decreaseFont = useCallback(() => setFontSize((prev) => Math.max(prev - 2, 12)), []);

  const goToNextChapter = useCallback(() => {
    if (selectedBook && currentChapterIndex < selectedBook.chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  }, [selectedBook, currentChapterIndex]);

  const goToPreviousChapter = useCallback(() => {
    if (selectedBook && currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  }, [selectedBook, currentChapterIndex]);

  const handleGoHome = useCallback(() => {
    setSelectedBook(null);
    setSelectedChapter(null);
    setSearchTerm("");
  }, []);

  // Filter chapters based on search term
  const filteredChapters = selectedBook?.chapters.filter((chapter) =>
    chapter.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 text-gray-800 font-sans transition-colors duration-300">
      {/* Status Bar */}
      {isOffline && (
        <div className="bg-yellow-500 text-gray-900 p-2 text-center text-sm font-medium shadow-lg flex items-center justify-center gap-2 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Bạn đang ở chế độ offline. Một số tính năng có thể bị giới hạn.
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-10 h-10 rounded-lg bg-white bg-opacity-20 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h1
                className="text-3xl font-extrabold tracking-tight cursor-pointer hover:text-yellow-300 transition"
                onClick={handleGoHome}
              >
                Truyện AI Dịch
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById("fileInput").click()}
                className="relative px-5 py-2 bg-white text-indigo-700 rounded-full hover:bg-opacity-90 transition-all duration-300 transform hover:scale-105 hover:shadow-lg font-medium flex items-center gap-2 shadow-lg group"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12"
                  />
                </svg>
                Tải Lên Thư Mục
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Tải thư mục chứa file .txt
                </span>
              </button>

              <button
                onClick={() => document.getElementById("featuredToggle").click()}
                className="relative px-5 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg font-medium flex items-center gap-2 shadow-lg group"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                Truyện Đề Xuất
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Xem truyện nổi bật
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* File Input */}
      <input
        id="fileInput"
        type="file"
        webkitdirectory
        multiple
        className="hidden"
        onChange={handleDirectoryUpload}
        accept=".txt,text/plain"
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Featured Books Section */}
        <section id="featured" className="mb-12">
          <h2 className="text-2xl font-bold text-indigo-800 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            Truyện Đề Xuất
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer group"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => (e.target.src = "https://via.placeholder.com/200x300?text=Cover+Not+Found")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4 text-white">
                      <h3 className="font-bold text-lg">{book.title}</h3>
                      <p className="text-sm text-gray-300">{book.author}</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg text-indigo-700">{book.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">Tác giả: {book.author}</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                      {book.genre}
                    </span>
                    <button
                      onClick={() => setSelectedBook({ ...book, chapters: [] })}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center gap-1 group-hover:underline"
                    >
                      Đọc ngay
                      <svg
                        className="w-4 h-4 transition-transform group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Loading Modal */}
        {uploading && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full animate-scaleIn">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-200"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                </div>
                <p className="mt-6 text-lg font-medium text-gray-700">Đang xử lý file...</p>
                <p className="text-sm text-gray-500 mt-2">Vui lòng chờ trong giây lát</p>
              </div>
            </div>
          </div>
        )}

        {/* Book Library Section */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Thư Viện Truyện
              </h2>

              {books.length === 0 ? (
                <div className="bg-indigo-50 rounded-xl p-6 text-center">
                  <svg
                    className="w-16 h-16 mx-auto text-indigo-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <p className="mt-4 text-gray-600">Chưa có truyện nào được tải lên</p>
                  <button
                    onClick={() => document.getElementById("fileInput").click()}
                    className="mt-4 px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:shadow-lg transition-all duration-300"
                  >
                    Tải Lên Thư Mục
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      className={`p-4 rounded-lg border-l-4 transition-all duration-200 shadow-sm hover:shadow-md ${
                        selectedBook?.id === book.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-transparent hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-indigo-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingBookId === book.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newBookTitle}
                                onChange={(e) => setNewBookTitle(e.target.value)}
                                className="flex-1 px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                onClick={handleSaveBookTitle}
                                className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600"
                              >
                                Lưu
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-center">
                                <h3
                                  className="font-medium text-indigo-700 truncate cursor-pointer"
                                  onClick={() => setSelectedBook(book)}
                                >
                                  {book.title}
                                </h3>
                                <button
                                  onClick={() => handleEditBookTitle(book.id, book.title)}
                                  className="text-yellow-500 hover:text-yellow-600"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 truncate">Tác giả: {book.author}</p>
                              <p className="text-xs text-gray-500 mt-1 truncate">Thể loại: {book.genre}</p>
                              <button
                                onClick={() => handleShowDeleteModal(book.id)}
                                className="text-red-500 hover:text-red-600 text-sm"
                              >
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Books Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                Truyện Đã Lưu
              </h2>

              {savedBooks.length === 0 ? (
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <svg
                    className="w-8 h-8 mx-auto text-yellow-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  <p className="mt-2 text-gray-600">Chưa có truyện nào được lưu</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2">
                  {savedBooks.map((bookId) => {
                    const book = books.find((b) => b.id === bookId);
                    return book ? (
                      <div
                        key={bookId}
                        className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm whitespace-nowrap flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                          </svg>
                          <span className="truncate">{book.title}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowDeleteModal(bookId);
                          }}
                          className="ml-2 text-indigo-400 hover:text-indigo-900 transition"
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-8">
            {!selectedBook ? (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <svg
                  className="w-16 h-16 mx-auto text-indigo-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="mt-4 text-gray-600 text-lg">Vui lòng chọn một truyện để xem danh sách chương</p>
              </div>
            ) : !selectedChapter ? (
              <>
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                      Danh Sách Chương - {selectedBook?.title} ({filteredChapters.length} chương)
                    </h2>
                    <div className="flex flex-col md:flex-row gap-3 mt-3 md:mt-0">
                      <input
                        type="text"
                        placeholder="Tìm kiếm chương..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleSaveBook}
                        className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 shadow"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                          />
                        </svg>
                        Lưu Toàn Bộ Truyện
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                    {filteredChapters.length === 0 ? (
                      <p className="text-gray-600 text-center col-span-full">
                        Không tìm thấy chương phù hợp
                      </p>
                    ) : (
                      filteredChapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          onClick={() => setSelectedChapter(chapter)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-1"
                        >
                          <h3 className="font-medium text-indigo-600">{chapter.title}</h3>
                          <p className="text-xs text-gray-500 mt-1">Độ dài: {chapter.content.length} ký tự</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                    <h2 className="text-xl font-bold text-indigo-700">{selectedChapter.title}</h2>
                    <div className="flex space-x-2 mt-3 md:mt-0">
                      <button
                        onClick={decreaseFont}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition shadow flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M20 12H4"
                          />
                        </svg>
                        A-
                      </button>
                      <button
                        onClick={increaseFont}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition shadow flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        A+
                      </button>
                    </div>
                  </div>

                  <div
                    style={{ fontSize: `${fontSize / 16}rem` }}
                    className="prose prose-base max-w-none p-6 bg-gray-50 rounded-lg shadow-inner min-h-[500px] overflow-y-auto text-gray-800 leading-relaxed whitespace-pre-wrap prose-p:my-4 prose-li:my-1 prose-img:rounded-lg prose-img:shadow-md prose-img:max-w-full prose-img:h-auto"
                  >
                    {selectedChapter.content || "Nội dung chương chưa có sẵn"}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={goToPreviousChapter}
                      disabled={currentChapterIndex === 0}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-lg transform hover:scale-105"
                    >
                      <svg
                        className="w-5 h-5 rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      Chương trước
                    </button>
                    <button
                      onClick={goToNextChapter}
                      disabled={currentChapterIndex === selectedBook.chapters.length - 1}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-lg transform"
                    >
                      Chương tiếp theo
                      <svg className="w-5 h-5" fill="none" stroke="white" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.447 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                Truyện AI Dịch
              </h3>
              <p className="text-indigo-100">Nền tảng đọc truyện dịch tự động với trải nghiệm người dùng tối ưu và giao diện hiện đại.</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-6">Liên Kết Nhanh</h4>
              <ul className="space-y-2">
                <li>
                  <button className="text-indigo-100 hover:text-white transition-colors">Trang Chủ</button>
                </li>
                <li>
                  <button className="text-indigo-100 hover:text-white transition-colors">Truyện Mới</button>
                </li>
                <li>
                  <button className="text-indigo-100 hover:text-white transition-colors">Thể Loại</button>
                </li>
                <li>
                  <button className="text-indigo-100 hover:text-white transition-colors">Liên Hệ</button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-6">Theo Dõi Chúng Tôi</h4>
              <div className="flex space-x-6">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-50 transition-colors duration-200">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-blue-400 transition-colors duration-200">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.058 10.058 0 01-3.127 1.194 4.92 4.923 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.916 4.916 0 00-.666 2.475c0 1.708.87 3.216 2.188 4.096a4.895 4.895 0 01-2.228-.616v.06a4.926 4.926 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-indigo-400 text-center text-gray-300">
            <p>© 2025 Truyện AI Dịch. Bản quyền thuộc về nhóm phát triển.</p>
          </div>
        </div>
      </footer>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-md shadow-lg p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-indigo-600">Xác Nhận Xóa</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-4 bg-red-50 rounded-md border border-red-200">
              <div className="flex items-center gap-3 text-red-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
                </svg>
                <p className="font-medium">Bạn đang thực hiện hành động nhạy cảm</p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Nhập mật khẩu quản trị
              </label>
              <input
                id="password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              {passwordError && <p className="mt-2 text-red-500 text-sm">{passwordError}</p>}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Xác Nhận
              </button>
            </div>
          </div>
      </div>
    )}

    {/* CSS for animations */}
    <style jsx>{`
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .animate-slideIn {
        animation: slideIn 0.3s ease-out forwards;
      }
    `}</style>
  </div>
);
}
