"""Middleware utilities for ComercialApp."""
from django.utils.deprecation import MiddlewareMixin


class APILoggingMiddleware(MiddlewareMixin):
    """Simple middleware that logs incoming requests to the console.

    Kept minimal to avoid introducing side effects. Present to satisfy
    the import referenced in `settings.py`.
    """

    def process_request(self, request):
        try:
            method = request.method
            path = request.get_full_path()
            print(f"[APILoggingMiddleware] {method} {path}")
        except Exception:
            pass

    # process_response not required, but included for clarity
    def process_response(self, request, response):
        return response
