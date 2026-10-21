import sqlite3,json,re
from pathlib import Path
s=Path('lib/agenda-entrega-realizada.ts').read_text()
remover,inserir=re.findall(r'prepare\(`([^`]+)`\)',s)
db=sqlite3.connect(':memory:')
db.execute('CREATE TABLE prestacoes(auth_user_id TEXT,competencia TEXT,municipio TEXT,associacao TEXT,atividades_json TEXT,total_minutos INTEGER,anexos_json TEXT,status TEXT,atualizado_em TEXT,UNIQUE(auth_user_id,competencia))')
db.execute("INSERT INTO prestacoes VALUES('tecnico','2026-11','Cidade','Associação','[{\"resumo\":\"Visita existente\"}]',120,'[]','enviado','')")
def salvar(qtd,user='tecnico',mes='2026-11'):
    with db:
        db.execute(remover,('agenda-1','agora','agenda-1'))
        db.execute(inserir,(user,mes,'Cidade','Associação',json.dumps([{'agendaEntregaId':'agenda-1','quantidadeMudas':str(qtd)}]),'agora'))
salvar(1000);salvar(1000);salvar(2000)
a=json.loads(db.execute("SELECT atividades_json FROM prestacoes WHERE auth_user_id='tecnico'").fetchone()[0]);assert len(a)==2 and a[0]['resumo']=='Visita existente' and a[1]['quantidadeMudas']=='2000'
salvar(3000,'outro','2026-12')
a=json.loads(db.execute("SELECT atividades_json FROM prestacoes WHERE auth_user_id='tecnico'").fetchone()[0]);assert len(a)==1 and a[0]['resumo']=='Visita existente'
assert db.execute("SELECT total_minutos FROM prestacoes WHERE auth_user_id='tecnico'").fetchone()[0]==120
assert sum(len([a for a in json.loads(r[0]) if a.get('agendaEntregaId')=='agenda-1']) for r in db.execute('SELECT atividades_json FROM prestacoes'))==1
with db:db.execute(remover,('agenda-1','agora','agenda-1'))
assert not any(a.get('agendaEntregaId')=='agenda-1' for r in db.execute('SELECT atividades_json FROM prestacoes') for a in json.loads(r[0]))
print('OK: conclusão idempotente, edição, mudança de responsável/mês e reabertura preservam demais atividades e horas.')
