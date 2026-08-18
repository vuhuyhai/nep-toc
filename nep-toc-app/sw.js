/**
 * NẾP TÓC — Service worker.
 *
 * Có hai việc:
 *   1. Cho phép cài app về máy. Chrome trên Android chỉ mời cài khi trang có manifest VÀ
 *      có service worker biết xử lý fetch. Thiếu file này thì nút "Thêm vào màn hình
 *      chính" không bao giờ hiện.
 *   2. Mở được app khi mất mạng, đọc lại tin đã tải.
 *
 * CHIẾN LƯỢC: MẠNG TRƯỚC, kho tạm chỉ là lưới đỡ khi mất mạng.
 *
 * Cố ý không dùng kho-trước cho nhanh. App này đổi nội dung mỗi ngày và tôi sửa mã liên
 * tục; kho-trước thì người dùng mở lên thấy bản cũ mà không hiểu vì sao, phải xóa dữ liệu
 * trình duyệt mới thấy bản mới. Chậm hơn nửa giây đáng giá hơn nhiều so với chuyện đó.
 */
const KHO = "nep-toc-v1";

// Chỉ những thứ cần để mở được app khi mất mạng. KHÔNG nhét dữ liệu tin vào đây,
// dữ liệu tự vào kho khi người ta đã xem qua một lần.
const KHUNG = ["/", "/index.html", "/chung.css", "/icon.svg", "/site.webmanifest"];

self.addEventListener("install", (e) => {
  // Bản mới nhận việc ngay, không chờ tab cũ đóng hết.
  self.skipWaiting();
  e.waitUntil(caches.open(KHO).then((c) => c.addAll(KHUNG).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Dọn kho của bản trước, không thì đổi tên kho xong vẫn còn rác nằm lại.
    const ten = await caches.keys();
    await Promise.all(ten.filter((t) => t !== KHO).map((t) => caches.delete(t)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Khác gốc thì để trình duyệt tự lo, đừng đụng vào (font Google chẳng hạn).
  if (url.origin !== location.origin) return;
  // KHÔNG bao giờ đụng tới hàm nền. Đó là chỗ gọi AI và kiểm danh tính, cache vào là hỏng.
  if (url.pathname.startsWith("/.netlify/")) return;

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      // Chỉ cất bản thành công. Cất cả trang lỗi thì lần sau mất mạng lại đưa ra trang lỗi.
      if (res && res.ok) {
        const kho = await caches.open(KHO);
        kho.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (e2) {
      const cu = await caches.match(req);
      if (cu) return cu;
      // Mất mạng mà chưa từng tải trang này: trả về trang chủ đã cất, còn hơn màn lỗi trắng.
      if (req.mode === "navigate") {
        const nha = await caches.match("/index.html");
        if (nha) return nha;
      }
      throw e2;
    }
  })());
});
