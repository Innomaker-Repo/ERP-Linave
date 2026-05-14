import json


class APILoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def _format_payload(self, payload):
        if payload is None:
            return 'null'

        if isinstance(payload, (bytes, bytearray)):
            try:
                payload = payload.decode('utf-8')
            except Exception:
                return repr(payload)

        if isinstance(payload, str):
            text = payload.strip()
            if not text:
                return '""'
            try:
                parsed = json.loads(text)
                return json.dumps(parsed, ensure_ascii=False, indent=2)
            except Exception:
                return text

        try:
            return json.dumps(payload, ensure_ascii=False, indent=2, default=str)
        except Exception:
            return str(payload)

    def __call__(self, request):
        if request.path.startswith('/comercial/'):
            method = request.method.upper()
            if method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
                print(f'\n[API REQUEST] {method} {request.path}', flush=True)
                print(self._format_payload(getattr(request, 'body', b'')), flush=True)

        response = self.get_response(request)

        if request.path.startswith('/comercial/'):
            method = request.method.upper()
            if method == 'GET' or method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
                print(f'\n[API RESPONSE] {method} {request.path} -> {getattr(response, "status_code", "?")}', flush=True)
                content = getattr(response, 'content', b'')
                print(self._format_payload(content), flush=True)

        return response