export const ETAPAS_PLANO=[
 {nome:"1. Identificação e seleção de propriedades rurais.",objetivo:"Identificar e selecionar propriedades rurais e famílias agricultoras aptas a participar do Projeto nos municípios atendidos.",acoes:"Realização do diagnóstico técnico; Seleção de propriedades e famílias agricultoras aptas; Identificação da fase produtiva e das necessidades de cada propriedade.",metas:"80 propriedades",resultados:"Público-alvo definido."},
 {nome:"2. Assistência técnica continuada.",objetivo:"Prestar assistência técnica continuada às propriedades atendidas, com acompanhamento e registro sistemático das atividades produtivas.",acoes:"Realização de visitas técnicas periódicas; Orientação em gestão da produção, preparo e adubação do solo, plantio, manejo, colheita, armazenamento e comercialização; Registro das ações em relatórios técnicos e fotografias.",metas:"Atendimento mínimo de 30 propriedades mensalmente por cada técnico.",resultados:"Melhoria das práticas produtivas, maior eficiência na produção e controle técnico das atividades realizadas."},
 {nome:"3. Fornecimento de insumos/mudas.",objetivo:"Fornecer insumos produtivos, mudas ou bens equivalentes, conforme diagnóstico local, com orientação técnica para implantação adequada.",acoes:"Definição das especificações técnicas; Aquisição e distribuição de mudas ou bens produtivos; Orientação e acompanhamento técnico da implantação.",metas:"Cumprir o Plano de Plantio de Mudas de cada produtor, incluindo especificações, quantitativos e prazos.",resultados:"Implantação adequada das culturas e fortalecimento da capacidade produtiva das propriedades."}
] as const;

export const OBJETIVOS_MONITORAMENTO=[
 {objetivo:ETAPAS_PLANO[0].objetivo,quantitativos:"Número de propriedades selecionadas por município.",qualitativos:"Grau de adequação das propriedades ao perfil produtivo e aos critérios do projeto.",fonte:"Relatórios de diagnóstico e fichas cadastrais.",coleta:"Visitas técnicas, entrevistas e análise documental.",responsavel:"Técnico de apoio e Coordenador/Subcoordenador.",periodicidade:"Etapa inicial do projeto."},
 {objetivo:ETAPAS_PLANO[1].objetivo,quantitativos:"Atendimento mínimo de 30 propriedades mensalmente por cada técnico.",qualitativos:"Evolução das práticas produtivas, adoção das orientações técnicas e melhoria da gestão.",fonte:"Relatórios de assistência técnica e registros fotográficos.",coleta:"Visitas técnicas, relatório mensal e registros sistemáticos.",responsavel:"Técnico de Campo.",periodicidade:"Mensal."},
 {objetivo:ETAPAS_PLANO[2].objetivo,quantitativos:"Número de mudas ou bens adquiridos e propriedades beneficiadas.",qualitativos:"Adequação dos insumos ao diagnóstico e correta implantação conforme orientação técnica.",fonte:"Relatórios de distribuição por propriedade e registros fotográficos.",coleta:"Acompanhamento in loco, registros fotográficos e relatórios técnicos.",responsavel:"Técnico de Campo e Coordenação/Subcoordenação.",periodicidade:"Conforme cronograma de aquisição, distribuição e implantação."}
] as const;

export const CARGOS_EQUIPE=[
 {cargo:"Técnico de Campo",numero:"3",escolaridade:"Médio",atribuicoes:"Prestar assessoria e orientação técnica em produção, preparo do solo, plantio, manejo, colheita, armazenamento e comercialização; alimentar bancos de dados e emitir relatórios.",periodo:"12 meses",natureza:"Contratação PJ."},
 {cargo:"Serviço de Apoio Administrativo",numero:"1",escolaridade:"Médio",atribuicoes:"Apoiar a associação no andamento do Projeto, na organização documental e na elaboração da prestação de contas.",periodo:"12 meses",natureza:"Contratação PJ."},
 {cargo:"Consultor de Projeto",numero:"1",escolaridade:"Superior",atribuicoes:"Planejar, organizar e controlar recursos financeiros, humanos e materiais, garantindo eficiência, conformidade legal e orçamentária.",periodo:"12 meses",natureza:"Contratação PJ."},
 {cargo:"Subcoordenador",numero:"1",escolaridade:"Superior",atribuicoes:"Auxiliar na organização, planejamento e execução, garantindo a continuidade do fluxo de trabalho e das metas do projeto.",periodo:"12 meses",natureza:"Contratação PJ."},
 {cargo:"Consultor de Articulação e Impacto Social",numero:"1",escolaridade:"Superior",atribuicoes:"Promover articulação institucional, integração entre organizações, poder público e comunidades e fortalecimento da inclusão produtiva.",periodo:"9 meses",natureza:"Contratação PJ."},
 {cargo:"Técnico de Comunicação",numero:"1",escolaridade:"Superior",atribuicoes:"Atender às demandas de comunicação visual e divulgação das atividades desenvolvidas pelo projeto.",periodo:"9 meses",natureza:"Contratação PJ."}
] as const;

export const ITENS_APLICACAO=[
 {item:"1.0 - Contratação de Pessoal - PJ: Técnicos de Campo",descricao:"Serviço de apoio técnico e orientação de campo e oficinas.",quantidade:"5760",unidade:"Hora",valorUnitario:"32,50",valorTotal:"187200,00"},
 {item:"2.0 - Contratação de Pessoal - PJ: Serviço de Apoio Administrativo",descricao:"Apoio administrativo e à prestação de contas da associação.",quantidade:"1920",unidade:"Hora",valorUnitario:"10,19375",valorTotal:"19572,00"},
 {item:"3.0 - Contratação de Pessoal - PJ: Consultor de Projeto",descricao:"Consultoria em elaboração de projetos, editais, gestão e conformidade.",quantidade:"1200",unidade:"Hora",valorUnitario:"75,00",valorTotal:"144000,00"},
 {item:"4.0 - Contratação de Pessoal - PJ: Subcoordenador",descricao:"Gerenciamento e supervisão da equipe e cumprimento das metas.",quantidade:"1200",unidade:"Hora",valorUnitario:"93,75",valorTotal:"180000,00"},
 {item:"5.0 - Mudas",descricao:"Aquisição de mudas diversas conforme diagnóstico.",quantidade:"1",unidade:"Lote",valorUnitario:"100000,00",valorTotal:"100000,00"},
 {item:"6.0 - Mudas",descricao:"Aquisição de mudas diversas conforme diagnóstico.",quantidade:"1",unidade:"Lote",valorUnitario:"100000,00",valorTotal:"100000,00"},
 {item:"7.0 - Consultor de Articulação e Impacto Social",descricao:"Consultoria especializada em articulação institucional e impacto social.",quantidade:"720",unidade:"Hora",valorUnitario:"75,00",valorTotal:"54000,00"},
 {item:"8.0 - Técnico de Comunicação",descricao:"Atendimento às demandas de comunicação visual do projeto.",quantidade:"720",unidade:"Hora",valorUnitario:"65,625",valorTotal:"47250,00"}
] as const;

export const CULTURAS_PLANO=["Café Conilon","Café Arábica","Cacau","Banana-da-terra","Banana","Maracujá","Pimenta-do-reino","Citros","Manga","Goiaba","Abacate","Palmáceas","Uva","Acerola","Mandioca","Piscicultura","Horticultura","Aquaponia","Apicultura","Hidroponia"] as const;
