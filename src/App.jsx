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
  const [searchTerm, setSearchTerm] = useState(""); // State cho tìm kiếm chương
  const [editingBookId, setEditingBookId] = useState(null); // State cho chỉnh sửa tên truyện
  const [newBookTitle, setNewBookTitle] = useState("");

  const ADMIN_PASSWORD = "truyenaidichdayA@";

  useEffect(() => {
    const request = indexedDB.open("TruyenAIDichDB", 2);
    
    request.onerror = (event) => {
      console.error("Không thể mở cơ sở dữ liệu");
    };

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
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (selectedBook) {
      setSelectedChapter(selectedBook.chapters[currentChapterIndex]);
    }
  }, [currentChapterIndex, selectedBook]);

  const loadBooksFromIndexedDB = (database) => {
    const transaction = database.transaction(["uploadedBooks"], "readonly");
    const store = transaction.objectStore("uploadedBooks");
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = (event) => {
      setBooks(event.target.result || []);
    };
  };

  const loadSavedBooksFromIndexedDB = (database) => {
    const transaction = database.transaction(["savedBooks"], "readonly");
    const store = transaction.objectStore("savedBooks");
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = (event) => {
      const savedBooks = event.target.result.map(item => item.id);
      setSavedBooks(savedBooks);
    };
  };

  const saveBookToIndexedDB = (book) => {
    if (!db) return;
    
    const transaction = db.transaction(["uploadedBooks"], "readwrite");
    const store = transaction.objectStore("uploadedBooks");
    store.put(book);
  };

  const saveSavedBookToIndexedDB = (bookId) => {
    if (!db) return;
    
    const transaction = db.transaction(["savedBooks"], "readwrite");
    const store = transaction.objectStore("savedBooks");
    store.put({ id: bookId });
  };

  const removeSavedBookFromIndexedDB = (bookId) => {
    if (!db) return;
    
    const transaction = db.transaction(["savedBooks"], "readwrite");
    const store = transaction.objectStore("savedBooks");
    store.delete(bookId);
  };

  const deleteBookFromIndexedDB = (bookId) => {
    if (!db) return;
    
    const transaction = db.transaction(["uploadedBooks"], "readwrite");
    const store = transaction.objectStore("uploadedBooks");
    store.delete(bookId);
  };

  const handleDirectoryUpload = async (event) => {
    if (isOffline) {
      alert("Không thể tải lên khi đang ở chế độ offline");
      return;
    }
    
    setUploading(true);
    const files = Array.from(event.target.files);
    
    const txtFiles = files
      .filter(file => file.name.toLowerCase().endsWith('.txt'))
      .sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
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
      chapters: []
    };

    for (const file of txtFiles) {
      try {
        const content = await readFileContent(file);
        newBook.chapters.push({
          id: newBook.chapters.length + 1,
          title: `Chương ${newBook.chapters.length + 1}: ${file.name.replace('.txt', '')}`,
          content: content
        });
      } catch (error) {
        console.error(`Lỗi đọc file ${file.name}:`, error);
        alert(`Không thể đọc file ${file.name}. Vui lòng kiểm tra định dạng hoặc mã hóa file.`);
      }
    }

    saveBookToIndexedDB(newBook);
    const updatedBooks = [...books, newBook];
    setBooks(updatedBooks);
    setSelectedBook(newBook);
    
    setUploading(false);
    alert(`Đã tải lên thành công ${newBook.chapters.length} chương`);
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = (e) => {
        reject(new Error(`Lỗi đọc file: ${e.target.error}`));
      };
      
      reader.readAsText(file, "UTF-8");
    });
  };

  const handleSaveBook = () => {
    if (!selectedBook) return;

    const alreadySaved = savedBooks.includes(selectedBook.id);

    if (alreadySaved) {
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
  };

  const handleShowDeleteModal = (bookId) => {
    setDeleteTargetId(bookId);
    setShowPasswordModal(true);
    setPasswordInput("");
    setPasswordError("");
  };

  const handleConfirmDelete = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      removeSavedBookFromIndexedDB(deleteTargetId);
      setSavedBooks(savedBooks.filter(id => id !== deleteTargetId));
      deleteBookFromIndexedDB(deleteTargetId);
      setBooks(books.filter(book => book.id !== deleteTargetId));
      if (selectedBook?.id === deleteTargetId) {
        setSelectedBook(null);
        setSelectedChapter(null);
      }
      setShowPasswordModal(false);
      setPasswordError("");
    } else {
      setPasswordError("Mật khẩu không chính xác");
    }
  };

  const handleEditBookTitle = (bookId) => {
    const book = books.find(b => b.id === bookId);
    setEditingBookId(bookId);
    setNewBookTitle(book.title);
  };

  const handleSaveBookTitle = () => {
    if (!newBookTitle.trim()) {
      alert("Tên truyện không được để trống");
      return;
    }
    const updatedBooks = books.map(book => 
      book.id === editingBookId ? { ...book, title: newBookTitle } : book
    );
    setBooks(updatedBooks);
    saveBookToIndexedDB(updatedBooks.find(b => b.id === editingBookId));
    setEditingBookId(null);
  };

  const increaseFont = () => setFontSize((prev) => Math.min(prev + 2, 24));
  const decreaseFont = () => setFontSize((prev) => Math.max(prev - 2, 12));

  const goToNextChapter = () => {
    if (selectedBook && currentChapterIndex < selectedBook.chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };

  const goToPreviousChapter = () => {
    if (selectedBook && currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const handleGoHome = () => {
    setSelectedBook(null);
    setSelectedChapter(null);
  };

  // Lọc chương theo searchTerm
  const filteredChapters = selectedBook?.chapters.filter(chapter => 
    chapter.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans transition-colors duration-300">
      {isOffline && (
        <div className="bg-yellow-300 text-gray-900 p-2 text-center text-sm font-medium shadow">
          Bạn đang ở chế độ offline. Một số tính năng có thể bị giới hạn.
        </div>
      )}

      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight cursor-pointer" onClick={handleGoHome}>Truyện AI Dịch</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => document.getElementById('fileInput').click()}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition text-sm font-medium shadow"
            >
              Tải Lên Thư Mục
            </button>
            <input
              id="fileInput"
              type="file"
              webkitdirectory
              multiple
              className="hidden"
              onChange={handleDirectoryUpload}
              accept=".txt,text/plain"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {uploading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-lg font-medium text-gray-700">Đang xử lý file...</p>
                <p className="text-sm text-gray-500 mt-2">Vui lòng chờ trong giây lát</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-2 text-blue-700">Danh Sách Truyện</h2>
            {books.length === 0 ? (
              <div className="bg-white p-6 rounded-lg shadow text-center">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                <p className="text-gray-600 mb-4">Chưa có truyện nào được tải lên</p>
                <button 
                  onClick={() => document.getElementById('fileInput').click()}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition shadow"
                >
                  Tải Lên Thư Mục
                </button>
              </div>
            ) : (
              books.map((book) => (
                <div
                  key={book.id}
                  className={`p-3 rounded-lg cursor-pointer border-l-4 transition-all duration-200 shadow-sm ${
                    selectedBook?.id === book.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-transparent hover:bg-gray-100"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    {editingBookId === book.id ? (
                      <input
                        type="text"
                        value={newBookTitle}
                        onChange={(e) => setNewBookTitle(e.target.value)}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div onClick={() => setSelectedBook(book)}>
                        <h3 className="font-medium text-blue-700">{book.title}</h3>
                        <p className="text-sm text-gray-600">Tác giả: {book.author}</p>
                        <p className="text-xs text-gray-500 mt-1">Thể loại: {book.genre}</p>
                      </div>
                    )}
                    <div className="flex space-x-2">
                      {editingBookId === book.id ? (
                        <button
                          onClick={handleSaveBookTitle}
                          className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
                        >
                          Lưu
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEditBookTitle(book.id)}
                          className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition"
                        >
                          Sửa
                        </button>
                      )}
                      <button
                        onClick={() => handleShowDeleteModal(book.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="md:col-span-2 space-y-6">
            {!selectedBook ? (
              <div className="bg-white p-6 rounded-lg shadow text-center">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p className="text-gray-600 mb-4">Vui lòng chọn một truyện để xem danh sách chương</p>
              </div>
            ) : !selectedChapter ? (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-blue-700">Danh Sách Chương - {selectedBook?.title}</h2>
                  <button
                    onClick={handleSaveBook}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition text-sm font-medium shadow"
                  >
                    Lưu Toàn Bộ Truyện
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm chương..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredChapters.map((chapter) => (
                    <div
                      key={chapter.id}
                      onClick={() => setSelectedChapter(chapter)}
                      className="p-3 border rounded hover:bg-blue-50 cursor-pointer transition-colors duration-200 shadow-sm"
                    >
                      <h3 className="font-medium text-blue-600">{chapter.title}</h3>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-blue-700">{selectedChapter.title}</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={decreaseFont}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition shadow"
                    >
                      A-
                    </button>
                    <button
                      onClick={increaseFont}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition shadow"
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div
                  style={{ fontSize: `${fontSize / 16}rem` }}
                  className="prose prose-base max-w-full p-4 bg-white rounded shadow-inner leading-relaxed whitespace-pre-wrap min-h-[500px] overflow-y-auto text-gray-800"
                >
                  {selectedChapter.content}
                </div>
                <div className="flex justify-between mt-4">
                  <button
                    onClick={goToPreviousChapter}
                    disabled={currentChapterIndex === 0}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow"
                  >
                    Chương trước
                  </button>
                  <button
                    onClick={goToNextChapter}
                    disabled={currentChapterIndex === selectedBook.chapters.length - 1}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow"
                  >
                    Chương tiếp theo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <aside className="fixed bottom-0 left-0 w-full bg-white shadow-lg border-t z-20">
        <div className="container mx-auto px-4 py-2">
          <h3 className="text-sm font-medium mb-2 text-blue-700">Truyện đã lưu:</h3>
          <div className="flex overflow-x-auto space-x-2 pb-2">
            {savedBooks.length === 0 ? (
              <span className="text-gray-500 italic">Chưa có truyện nào được lưu.</span>
            ) : (
              savedBooks.map((bookId, index) => {
                const book = books.find(b => b.id === bookId);
                return book ? (
                  <div
                    key={bookId}
                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm whitespace-nowrap flex items-center shadow"
                  >
                    {book.title}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowDeleteModal(bookId);
                      }}
                      className="ml-2 text-blue-400 hover:text-blue-900 transition"
                    >
                      ×
                    </button>
                  </div>
                ) : null;
              })
            )}
          </div>
        </div>
      </aside>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-80">
            <h3 className="text-lg font-medium mb-4 text-blue-700">Xác nhận mật khẩu</h3>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full p-2 border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {passwordError && (
              <p className="text-red-500 text-sm mb-3">{passwordError}</p>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition shadow"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
