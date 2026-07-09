import os, json, random, time
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ERP_Linave_BackEnd.settings')
import django
django.setup()
from ComercialApp.models import Workspace

def get_workspace(admin='admin@modo-teste.com'):
    return Workspace.objects.filter(admin_email=admin).first()

def snapshot(w):
    data = w.data if w and w.data else {}
    obras = data.get('obras', [])
    os_list = data.get('os', [])
    last = obras[-1] if obras else None
    return {
        'obras_count': len(obras),
        'os_count': len(os_list),
        'last_obra': last,
        'last_os_3': os_list[-3:]
    }

def save_workspace(w, data):
    w.data = data
    w.save()

def gen_id_projeto():
    prefix = 'LN'
    numero = f"{random.randint(1,9999):04d}"
    ano = str(time.localtime().tm_year)[-2:]
    return f"{prefix}-{numero}/{ano}"

def gen_id_os():
    return f"OS-{int(time.time()*1000)}-0"

def pretty(o):
    return json.dumps(o, ensure_ascii=False, indent=2)

def main():
    w = get_workspace()
    if not w:
        print('Workspace not found for admin@modo-teste.com')
        return

    print('\n[INITIAL SNAPSHOT]')
    before = snapshot(w)
    print(pretty(before))

    # 1) Create negócio (obra)
    data = w.data or {}
    obras = data.get('obras', [])
    new_id = gen_id_projeto()
    obra = {
        'id': new_id,
        'nome': f'E2E Flow {new_id}',
        'clienteId': 'CLI-E2E',
        'dataCadastro': time.strftime('%Y-%m-%d'),
        'status': 'Pre-Venda',
        'categoria': 'Planejamento',
        'servicos': [
            {'id': 'srv-e2e-1', 'tipo': 'Teste', 'descricao': 'Serviço E2E teste'}
        ],
        'empresaPrestadora': 'Linave',
        'solicitante': 'E2E Test'
    }
    obras.append(obra)
    data['obras'] = obras
    save_workspace(w, data)
    print('\n[AFTER CREATE OBRA]')
    after1 = snapshot(w)
    print(pretty(after1))

    # 2) Orçar negócio (add orcamento)
    data = w.data
    obras = data.get('obras', [])
    target = next((o for o in obras if o.get('id')==new_id), None)
    if not target:
        print('Created obra not found')
        return
    orc = {
        'versao': 'A',
        'dataCriacao': time.strftime('%Y-%m-%d'),
        'status': 'pendente',
        'numeroOrcamento': new_id.replace('/', '') + 'A'
    }
    target.setdefault('orcamentos', []).append(orc)
    save_workspace(w, data)
    print('\n[AFTER CREATE ORCAMENTO]')
    after2 = snapshot(w)
    print(pretty(after2))

    # 3) Aprovar orçamento
    data = w.data
    obras = data.get('obras', [])
    target = next((o for o in obras if o.get('id')==new_id), None)
    if target and target.get('orcamentos'):
        target['orcamentos'][-1]['status'] = 'aceito'
        # move to Negotiation
        target['categoria'] = 'Negociação'
    save_workspace(w, data)
    print('\n[AFTER APPROVE ORCAMENTO]')
    after3 = snapshot(w)
    print(pretty(after3))

    # 4) Criar proposta
    data = w.data
    obras = data.get('obras', [])
    target = next((o for o in obras if o.get('id')==new_id), None)
    proposta = {
        'versao': 'A',
        'dataCriacao': time.strftime('%Y-%m-%d'),
        'status': 'pendente',
        'numeroProposta': new_id.replace('/', '') + 'P'
    }
    target.setdefault('propostas', []).append(proposta)
    save_workspace(w, data)
    print('\n[AFTER CREATE PROPOSTA]')
    after4 = snapshot(w)
    print(pretty(after4))

    # 5) Aprovar proposta
    data = w.data
    obras = data.get('obras', [])
    target = next((o for o in obras if o.get('id')==new_id), None)
    if target and target.get('propostas'):
        target['propostas'][-1]['status'] = 'aceita'
        target['categoria'] = 'Em Andamento'
        target['status'] = 'Em Andamento'
    save_workspace(w, data)
    print('\n[AFTER APPROVE PROPOSTA]')
    after5 = snapshot(w)
    print(pretty(after5))

    # 6) Criar OS
    data = w.data
    os_list = data.get('os', [])
    new_os = {
        'id': gen_id_os(),
        'obraId': new_id,
        'obraNome': target.get('nome'),
        'descricao': 'OS criada pelo fluxo E2E',
        'dataCriacao': time.strftime('%Y-%m-%d'),
        'status': 'Ativo',
        'statusEnvio': 'pendente',
        'empresaPrestadora': 'Linave'
    }
    os_list.append(new_os)
    data['os'] = os_list
    save_workspace(w, data)
    print('\n[AFTER CREATE OS]')
    after6 = snapshot(w)
    print(pretty(after6))

    # 7) Enviar OS
    data = w.data
    os_list = data.get('os', [])
    for o in os_list:
        if o.get('obraId')==new_id:
            o['statusEnvio'] = 'enviada'
    save_workspace(w, data)
    print('\n[AFTER SEND OS]')
    after7 = snapshot(w)
    print(pretty(after7))

    # 8) Aprovar OS (marcar aprovada)
    data = w.data
    os_list = data.get('os', [])
    for o in os_list:
        if o.get('obraId')==new_id:
            o['statusAprovacao'] = 'aprovada'
            o['dataAprovacao'] = time.strftime('%Y-%m-%d')
    save_workspace(w, data)
    print('\n[AFTER APPROVE OS]')
    after8 = snapshot(w)
    print(pretty(after8))

    print('\nFlow completed. Summary:')
    print('created_obra_id:', new_id)

if __name__ == '__main__':
    main()
