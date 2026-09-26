"""Piepklein endpoint: de generator-pagina POST't de PNG hierheen.
Zo hoeft de afbeelding nergens door een tekstkanaal."""
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo-root


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        name = os.path.basename(self.path.lstrip("/")) or "out.png"
        n = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(n)
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(("saved %s (%d bytes)" % (name, len(data))).encode())
        print("saved %s (%d bytes)" % (name, len(data)), flush=True)

    def log_message(self, *a):
        pass


def do_GET(self):
    """Een browser die hier toevallig langskomt, houdt anders de enige
    verbinding bezet. Daarom threading, en een kort antwoord op GET."""
    self.send_response(200)
    self._cors()
    self.send_header("Content-Type", "text/plain; charset=utf-8")
    self.end_headers()
    self.wfile.write("ogsave staat klaar. Open tools/og.html op de andere server.".encode())


H.do_GET = do_GET

srv = ThreadingHTTPServer(("127.0.0.1", 8124), H)
srv.daemon_threads = True
print("ogsave luistert op http://127.0.0.1:8124", flush=True)
srv.serve_forever()
