import re
from django.core.exceptions import ValidationError


class SenhaSeguraValidator:
    """
    Exige: mínimo 8 caracteres, ao menos 1 maiúscula, 1 minúscula e 1 caractere especial.
    """

    ESPECIAIS = r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>/?\\|`~]'

    def validate(self, password, user=None):
        erros = []
        if len(password) < 8:
            erros.append('A senha deve ter no mínimo 8 caracteres.')
        if not re.search(r'[A-Z]', password):
            erros.append('A senha deve conter pelo menos uma letra maiúscula.')
        if not re.search(r'[a-z]', password):
            erros.append('A senha deve conter pelo menos uma letra minúscula.')
        if not re.search(self.ESPECIAIS, password):
            erros.append('A senha deve conter pelo menos um caractere especial (!@#$%^&* etc.).')
        if erros:
            raise ValidationError(erros)

    def get_help_text(self):
        return (
            'A senha deve ter no mínimo 8 caracteres, '
            'incluindo letras maiúsculas, minúsculas e um caractere especial.'
        )
