#!/usr/bin/env python
"""
Script para adicionar o OrdenServiçoSerializer ao arquivo serializers.py
"""

with open('ComercialApp/serializers.py', 'a') as f:
    f.write('''


# --------------------- Ordem de Serviço (OS) ---------------------

class OrdenServiçoSerializer(serializers.ModelSerializer):
    # Detalhes dos relacionamentos (leitura)
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioSerializer(source='negocio', read_only=True)
    
    # Chaves para relacionamentos (escrita)
    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source='cliente',
        write_only=True
    )
    negocio_id = serializers.PrimaryKeyRelatedField(
        queryset=Negocio.objects.all(),
        source='negocio',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = OrdenServiço
        fields = [
            'id', 'numero_os', 'data_emissao',
            'cliente', 'cliente_id', 'cliente_detalhes',
            'negocio', 'negocio_id', 'negocio_detalhes',
            'projeto', 'equipamento', 'local', 'cc',
            'data_inicio_previsto', 'data_termino_previsto',
            'supervisor_encarregado', 'descricao_geral_servico',
            'a_ser_incluido', 'mao_obra',
            'status_os', 'status_envio', 'status_aprovacao',
            'data_aprovacao', 'documento_assinatura_aprovacao',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'numero_os', 'data_emissao', 'created_at', 'updated_at')
    
    def create(self, validated_data):
        """
        Cria uma nova OrdenServiço, gerando um número único automaticamente
        """
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        numero_os = f"OS-{timestamp}"
        
        contador = 1
        numero_original = numero_os
        while OrdenServiço.objects.filter(numero_os=numero_os).exists():
            numero_os = f"{numero_original}-{contador}"
            contador += 1
        
        validated_data['numero_os'] = numero_os
        return super().create(validated_data)
''')

print('OrdenServiçoSerializer adicionado com sucesso!')
