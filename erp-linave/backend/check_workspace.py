import os, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ERP_Linave_BackEnd.settings')
import django
django.setup()
from ComercialApp.models import Workspace
w = Workspace.objects.filter(admin_email='admin@modo-teste.com').first()
if not w:
    print(json.dumps({'found': False}))
else:
    obras = w.data.get('obras', [])
    os_list = w.data.get('os', [])
    last = obras[-1] if obras else None
    out = {
        'found': True,
        'obras_count': len(obras),
        'os_count': len(os_list),
        'last_obra': None,
        'last_os_3': os_list[-3:]
    }
    if last:
        out['last_obra'] = {
            'id': last.get('id'),
            'nome': last.get('nome'),
            'status': last.get('status'),
            'categoria': last.get('categoria'),
            'orcamentos_count': len(last.get('orcamentos') or []),
            'propostas_count': len(last.get('propostas') or [])
        }
    print(json.dumps(out, ensure_ascii=False, indent=2))
