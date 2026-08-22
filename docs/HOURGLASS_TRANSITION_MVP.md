# Hourglass Transition MVP — Schema confirmado e limites

## Evidência de formato

A implementação suporta apenas o schema observado localmente em exports Hourglass **JSON**, no CSV de contactos e na matriz CSV de privilégios correspondente. Foram também perfilados quatro calendários DOCX de agosto de 2026. Os ficheiros reais foram tratados como dados sensíveis, não foram adicionados ao repositório e não serão emitidos em logs, auditoria ou testes.

O perfil JSON confirmou as secções `publishers`, `fsGroups` e `privileges`. Cada `publishers[].id` é um inteiro único e as listas de `privileges` contêm apenas inteiros que referenciam esses IDs. Assim, `publishers[].id` é o identificador externo de reconciliação comprovado para o adapter. `publishers[].uuid` pode ser validado como metadado de integridade, mas não substitui esse relacionamento comprovado.

> Eligibility importada é sempre uma afirmação explícita de `privileges[privilegeType] -> publishers[].id`. O importador não cria eligibility a partir de `appt`, `pioneerid`, sexo, datas pessoais, baptismo, presença, comentários, tags, estado, grupos, ou qualquer outro campo.

## Dados utilizados e minimização

| Secção | Campos usados pelo MVP | Tratamento |
|---|---|---|
| `publishers` | `id`, nome para prévia, `uuid` para validação de integridade | O ID é convertido para o namespace externo Hourglass. O nome serve apenas para a criação/reconciliação de pessoa após confirmação. Contactos, moradas, datas pessoais, comentários e credenciais são ignorados e nunca registados. |
| `privileges` | Nome da chave de privilégio e IDs de publicadores associados | Importa somente grants explícitos, no namespace `hourglass:<privilege>`. Não mapeia implicitamente esses grants para tipos internos de partes. |
| `fsGroups` | Existência, ID, nome e relações comprovadas | Incluídos no relatório de prévia. Não são convertidos em privilégios ou elegibilidade. |
| CSV contact list | Cabeçalhos e dados de contacto apenas para inspeção de formato | Não contém um ID externo de pessoa comprovado, logo não pode executar reconciliação/persistência sozinho. |
| CSV privilege matrix | Cabeçalhos de papel e markers não vazios por linha | A matriz tem colunas de nome, mas não o `publishers[].id` estável. Cada grant exige reconciliação humana explícita com uma referência externa já conhecida; o parser nunca associa pessoas por nome. |
| Calendários DOCX | Estrutura de tabelas, etiquetas operacionais e datas/partes apresentadas | Podem ser consultados como documentos de referência humana. Os DOCX observados não comprovam um formato de importação nem um registo estruturado de histórico individual. |

## Segurança e prévia

O adapter deve impor limite de ficheiro e de registos, rejeitar JSON inválido, formatos não reconhecidos e chaves potencialmente perigosas (`__proto__`, `prototype`, `constructor`). Ele nunca executa conteúdo importado. Campos desconhecidos são descritos apenas por nome e contagem no relatório; os respetivos valores não são persistidos em logs ou auditoria.

Nenhuma escrita é efetuada antes de uma confirmação humana. A prévia é idempotente por `hourglass:<publisher.id>` dentro do tenant e classifica cada item como novo, existente sem alteração, conflito, atualização pendente ou inválido. Alterações não substituem informação Eutaktos sem uma decisão explícita de resolução.

## Limites comprovados do export recebido

O export analisado inclui `attendance`, mas essa secção contém agregados de presença por período e grupo. Não contém identificador de reunião, parte, pessoa atribuída, estado de designação ou registo individual de designação. Também não foram observadas secções de designações, histórico, agenda, ausências ou disponibilidade.

Por esse motivo, o MVP pode expor **Hourglass handoff** em CSV, JSON e visualização imprimível para conferência manual, mas não pode alegar que o ficheiro é importável pelo Hourglass. Um serializer de round-trip só será considerado se uma fixture posterior comprovar o formato de importação de agenda do Hourglass.

A matriz CSV de privilégios mostra grants explicitamente marcados, mas as suas linhas não transportam um `publishers[].id`; por isso não pode produzir eligibility sem uma reconciliação humana individual. Isso evita colisões por homónimos e qualquer concessão silenciosa de eligibility.

Os quatro DOCX observados contêm tabelas e etiquetas de calendário/reunião, mas não provam um formato de dados transacional nem um contrato de importação Hourglass. A sua informação só pode ser usada para conferência humana no MVP atual.

Da mesma forma, H03 e a recência H04 só podem ingerir histórico de designações quando uma fixture sanitizada comprovar a respetiva secção e os seus campos. Não é aceitável adivinhar esse schema a partir de agregados de `attendance`, de uma matriz de privilégios ou de tabelas DOCX visuais.
