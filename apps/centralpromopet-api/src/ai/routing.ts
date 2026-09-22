import type { Context } from './graph';
import type { PetAction } from './contracts';

type PetType = 'dogs' | 'cats' | 'all';
type PetSpecies = 'dogs' | 'cats';

function normalize(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mentionedPetType(value: string): PetType | null {
  const text = normalize(value);
  const dog = /\b(cao|caes|cachorr\w*|canin\w*|dog)\b/.test(text);
  const cat = /\b(gat\w*|felin\w*|cat)\b/.test(text);
  if (dog === cat) return null;
  return dog ? 'dogs' : 'cats';
}

function productQuery(value: string) {
  const text = normalize(value);
  if (/\b(rac\w*|comida|aliment\w*)\b/.test(text)) return 'ração';
  if (/\b(petisc\w*)\b/.test(text)) return 'petisco';
  if (/\b(brinqued\w*)\b/.test(text)) return 'brinquedo';
  if (/\b(areia|arranhador)\b/.test(text)) return 'gato';
  if (/\b(coleira|guia|peitoral)\b/.test(text)) return 'coleira';
  return null;
}

function isNameQuestion(value: string) {
  const text = normalize(value);
  return !isSpeciesQuestion(value) && /\bqual\b.{0,35}\bnome\b|\bcomo\b.{0,25}\bchama\b/.test(text) && value.includes('?');
}

function isSpeciesQuestion(value: string) {
  return /\b(especie|c[aã]o(?:zinho)? ou gato(?:zinho)?|cachorro ou gato|gatinho ou cachorro)\b/i.test(value) && value.includes('?');
}

function nameFromAnswer(value: string) {
  const name = value.trim().replace(/^(?:o nome(?: dele| dela)? é|é|chama-se|meu pet se chama)\s+/i, '').replace(/[.!?]+$/, '').trim();
  if (!name || name.length > 80 || name.split(/\s+/).length > 3 || /\b(rac\w*|comida|aliment\w*|petisc\w*|brinqued\w*|filhote|adulto|idoso)\b/i.test(normalize(name))
    || /^(sim|claro|nao|não|obrigad[oa]|filhote|adulto|idoso|c[aã]o|cachorro|gato)$/i.test(name)) return null;
  return name;
}

function previousPetName(recent: Context['recent']) {
  let name: string | null = null;
  for (let index = 0; index < recent.length - 1; index += 1) {
    if (recent[index].role === 'assistant' && isNameQuestion(recent[index].content) && recent[index + 1].role === 'user') {
      name = nameFromAnswer(recent[index + 1].content);
    }
  }
  return name;
}

function formatPetNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0];
}

function referencedPet(message: string, recent: Context['recent'], pets: Context['pets']) {
  const current = normalize(message);
  const namedInMessage = pets.find((pet) => current.includes(normalize(pet.name)));
  if (namedInMessage) return namedInMessage;
  const history = normalize(recent.map((entry) => entry.content).join('\n'));
  const mentioned = pets.filter((pet) => history.includes(normalize(pet.name)));
  if (mentioned.length === 1) return mentioned[0];
  const type = mentionedPetType(message);
  const sameType = type ? pets.filter((pet) => pet.type === type) : [];
  if (sameType.length === 1) return sameType[0];
  return pets.length === 1 ? pets[0] : null;
}

function birthDateFromMessage(message: string) {
  const text = normalize(message);
  const months: Record<string, number> = {
    janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4,
    maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8,
    setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
  };
  for (const [monthName, birthMonth] of Object.entries(months)) {
    const match = text.match(new RegExp(`\\b${monthName}\\s+(?:de\\s+)?(19\\d{2}|20\\d{2})\\b`));
    if (match) return { birthMonth, birthYear: Number(match[1]), sourceQuote: message.slice(match.index!, match.index! + match[0].length) };
  }
  const numeric = message.match(/\b(0?[1-9]|1[0-2])\s*[/.\-]\s*(19\d{2}|20\d{2})\b|\b(19\d{2}|20\d{2})\s*[/.\-]\s*(0?[1-9]|1[0-2])\b/);
  if (numeric) return { birthMonth: Number(numeric[1] || numeric[4]), birthYear: Number(numeric[2] || numeric[3]), sourceQuote: numeric[0] };
  return null;
}

function breedSpecies(breed: string | null | undefined): PetSpecies | null {
  const value = normalize(breed || '');
  const dogBreed = /\b(york|yorkshire|poodle|labrador|golden retriever|shih tzu|lhasa apso|beagle|husky|rottweiler|border collie|pastor alemao|bulldog|pinscher|chihuahua|dachshund|salsicha|pug|boxer|cocker|dalmata)\b/;
  const catBreed = /\b(siam[eê]s|persa|maine coon|sphynx|esfinge|ragdoll|bengal|british shorthair)\b/;
  if (dogBreed.test(value)) return 'dogs';
  if (catBreed.test(value)) return 'cats';
  return null;
}

function breedFromMessage(message: string) {
  return /\byork(?:shire)?\b/i.test(normalize(message)) ? 'Yorkshire' : null;
}

function petTypeLabel(type: string) {
  return ({ dogs: 'cão', cats: 'gato', birds: 'pássaro', other: 'outro pet' } as Record<string, string>)[type] || 'pet';
}

function isProfileQuestion(message: string) {
  const text = normalize(message);
  return !/\b(feliz|cuid\w*|suger\w*|brinc\w*|aliment\w*)\b/.test(text)
    && /\b(o que|qual|quais|como)\b.{0,70}\b(cadastro|cadastrad\w*|registrad\w*|consta)\b|\b(cadastro|cadastrad\w*|registrad\w*|consta)\b.{0,70}\b(pet|antonio|nome|especie|raca|idade|informac\w*)\b/.test(text);
}

export function analyzeTurn(message: string, context: Context) {
  const userHistory = context.recent.filter((entry) => entry.role === 'user').map((entry) => entry.content);
  const conversation = [...userHistory, message].join('\n');
  const normalizedMessage = normalize(message.trim());
  const greeting = userHistory.length === 0 && /^(oi|ola|bom dia|boa tarde|boa noite)(?:[,!?. ]+(?:tudo bem|tudo bom|como vai))?[!?., ]*$/.test(normalizedMessage);
  const greetingOnly = greeting && context.pets.length === 0;
  const directQuery = productQuery(message);
  const currentType = mentionedPetType(message);
  const previousType = [...userHistory].reverse().map(mentionedPetType).find(Boolean) || null;
  const registeredPetType = context.pets.length === 1 ? context.pets[0].type : null;
  const registeredType: PetType | null = registeredPetType === 'dogs' || registeredPetType === 'cats' ? registeredPetType : null;
  const petType = currentType || previousType || registeredType || 'all';
  const declined = /\bnao(?:\s+nao)?\s+obrigad[oa]\b|\bnao quero\b|\bdeixa pra la\b|\bagora nao\b|\bsem interesse\b/.test(normalize(message));
  const closing = /^(obrigad[oa]|valeu|tchau|ate mais|era isso)[!. ]*$/i.test(normalize(message.trim()));
  const lastAssistant = [...context.recent].reverse().find((entry) => entry.role === 'assistant')?.content || '';
  const affirmative = /^(claro|sim|pode|pode sim|isso|com certeza|quero(?: sim)?|ok|okay|tenho|tenho sim|sim tenho)[!. ]*$/i.test(normalizedMessage);
  const saysAlreadyRegistered = /\bja\b.{0,35}\bcadastr\w*\b/.test(normalizedMessage);
  const petNameFromHistory = previousPetName(context.recent);
  let directReply: string | null = null;
  let createPet: { fields: { name: string; type: PetSpecies }; sourceQuote: string } | null = null;
  let updatePet: Extract<PetAction, { kind: 'update_pet' }> | null = null;
  const askedForOfferDetails = /\b(cadastr\w*|salv\w*|guard\w*)\b.{0,70}\b(oferta|promoc\w*)\b|\bdetalh\w*\b.{0,60}\b(oferta|promoc\w*)\b|\b(oferta|promoc\w*)\b.{0,60}\bdetalh\w*\b/.test(normalize(lastAssistant));
  const pet = referencedPet(message, context.recent, context.pets);
  const requestedBreed = breedFromMessage(message);
  const requestedBreedSpecies = requestedBreed ? breedSpecies(requestedBreed) : null;
  const birthMissing = pet && (pet.birthMonth == null || pet.birthYear == null);
  const ageAnswer = /\b\d{1,2}\s*(?:anos?|mes(?:es)?|semanas?)\b/.test(normalize(message)) || (/^\d{1,2}[!. ]*$/.test(normalizedMessage) && /\bidade|quantos anos|quantos meses\b/i.test(lastAssistant));
  const ageQuestion = /\bidade|quantos anos|quantos meses\b/i.test(lastAssistant);
  const birthQuestion = /\bnasc\w*|\bmes e ano\b/i.test(lastAssistant);
  const ageDescription = /\b(nov[oa]s?|novinh[oa]s?|filhote|velh[oa]s?|velhinh[oa]s?|idos[oa]s?)\b/.test(normalize(message));
  const birthDate = birthDateFromMessage(message);
  const petRelated = ageQuestion || birthQuestion || ageDescription || currentType !== null
    || context.pets.some((item) => normalizedMessage.includes(normalize(item.name)))
    || /\b(pet|animal|ele|ela|dele|dela)\b/.test(normalizedMessage);

  if (pet && birthMissing && birthDate && petRelated) {
    if (birthDate.birthYear > new Date().getFullYear()) {
      directReply = 'Esse ano de nascimento ainda está no futuro. Você pode conferir o mês e o ano?';
    } else if (pet.birthMonth === birthDate.birthMonth && pet.birthYear === birthDate.birthYear) {
      directReply = `Já tenho esse nascimento (${String(birthDate.birthMonth).padStart(2, '0')}/${birthDate.birthYear}) no cadastro do ${pet.name}.`;
    } else {
      updatePet = { kind: 'update_pet', petId: pet.id, fields: { birthMonth: birthDate.birthMonth, birthYear: birthDate.birthYear }, sourceQuote: birthDate.sourceQuote };
      directReply = `Entendi: ${pet.name} nasceu em ${String(birthDate.birthMonth).padStart(2, '0')}/${birthDate.birthYear}. Preparei a atualização do cadastro; confira e confirme no botão abaixo.`;
    }
  } else if (pet && requestedBreedSpecies && (pet.type === 'dogs' || pet.type === 'cats') && requestedBreedSpecies !== pet.type) {
    directReply = `Só para confirmar: ${pet.name} está cadastrado como ${petTypeLabel(pet.type)}, mas ${requestedBreed} é uma raça de ${petTypeLabel(requestedBreedSpecies)}. ${pet.name} é cão ou gato?`;
  } else if (pet && (currentType === 'dogs' || currentType === 'cats') && currentType !== pet.type
    && /\b(ra[cç]a|yorkshire|c[aã]o ou gato|gato ou c[aã]o)\b/i.test(lastAssistant)) {
    updatePet = { kind: 'update_pet', petId: pet.id, fields: { type: currentType }, sourceQuote: message.trim() };
    directReply = `Entendi — ${pet.name} é ${petTypeLabel(currentType)}. Preparei a correção do tipo no cadastro; confira e confirme no botão abaixo.`;
  } else if (pet && isProfileQuestion(message)) {
    const facts = [`${pet.name} está cadastrado como ${petTypeLabel(pet.type)}`];
    if (pet.breed) facts.push(`raça ${pet.breed}`);
    if (pet.birthMonth && pet.birthYear) facts.push(`nascimento em ${String(pet.birthMonth).padStart(2, '0')}/${pet.birthYear}`);
    const mismatch = breedSpecies(pet.breed) && breedSpecies(pet.breed) !== pet.type;
    directReply = mismatch
      ? `No cadastro, ${facts.join(' e ')}. Esses dados parecem não combinar: ${pet.breed} é raça de ${petTypeLabel(breedSpecies(pet.breed)!)}. ${pet.name} é cão ou gato?`
      : `No cadastro, ${facts.join(' e ')}.`;
  } else if (pet && /\b(tudo|tanto faz|quero sim|quero|sim|claro)\b/.test(normalizedMessage)
    && /\b(ra[cç]a|idade|informa[cç][õo]es|adicionar|atualizar)\b/i.test(lastAssistant)) {
    const missing: string[] = [];
    if (!pet.breed) missing.push('raça');
    if (!pet.birthMonth || !pet.birthYear) missing.push('mês e ano de nascimento');
    directReply = missing.length
      ? `Claro! Pode me contar de uma vez o que souber sobre ${pet.name}${missing.length === 2 ? ` — ${missing[0]} e ${missing[1]}` : ` — ${missing[0]}`}. Pode pular o que não souber.`
      : `As informações principais de ${pet.name} já estão no cadastro. Quer ajuda com algum cuidado ou produto para ele?`;
  } else if (pet && birthMissing && ageAnswer && petRelated) {
    directReply = `Entendi, ${pet.name} tem cerca de ${normalize(message).match(/\b\d{1,2}\s*(?:anos?|mes(?:es)?|semanas?)\b/)?.[0] || 'essa idade'}. Para atualizar o nascimento sem chutar a data, você sabe o mês e o ano em que ele nasceu?`;
  } else if (pet && birthMissing && (ageQuestion || birthQuestion) && /\b(nao sei|nao lembro|nao tenho certeza)\b/.test(normalize(message))) {
    directReply = `Sem problema, não vou inventar a data de nascimento do ${pet.name}. Posso continuar ajudando com as informações que já tenho.`;
  } else if (pet && birthMissing && ageDescription && !ageAnswer) {
    directReply = `Ah, entendi! Quantos meses ou anos o ${pet.name} tem?`;
  } else if (greeting && context.pets.length) {
    const petNames = formatPetNames(context.pets.map((pet) => pet.name));
    directReply = `Oi! Tudo bem por aqui, e você? Já encontrei ${petNames} no cadastro 😊 Como posso ajudar com ele${context.pets.length > 1 ? 's' : ''}?`;
  } else if (affirmative && askedForOfferDetails) {
    directReply = 'Os detalhes e o botão “Ver oferta” já estão no card acima. Espero que seja uma boa opção para vocês!';
  } else if (/\btem algum pet|tem um pet|tem pet em casa\b/i.test(lastAssistant) && (affirmative || saysAlreadyRegistered) && context.pets.length) {
    const petNames = formatPetNames(context.pets.map((pet) => pet.name));
    directReply = context.pets.length === 1
      ? `Ah, verdade! Já tenho ${petNames} no cadastro 😊 Como posso ajudar com ele?`
      : `Ah, verdade! Já tenho ${petNames} no cadastro 😊 Como posso ajudar com eles?`;
  } else if (/\btem algum pet|tem um pet|tem pet em casa\b/i.test(lastAssistant) && affirmative) {
    directReply = 'Que legal! É um cãozinho ou gatinho?';
  } else if (isNameQuestion(lastAssistant)) {
    const name = nameFromAnswer(message);
    if (name) {
      const species = currentType === 'dogs' || currentType === 'cats' ? currentType : previousType || registeredType;
      if (species === 'dogs' || species === 'cats') {
        const existing = context.pets.find((pet) => pet.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
        if (existing) directReply = `${name} já consta no seu cadastro. Posso ajudar com alguma informação sobre ele?`;
        else {
          createPet = { fields: { name, type: species }, sourceQuote: message.trim() };
          directReply = `Legal, ${name}! Preparei o cadastro como ${species === 'dogs' ? 'cão' : 'gato'}; confira e confirme no botão abaixo.`;
        }
      } else {
        directReply = `${name} — que nome legal! Ele é cãozinho ou gatinho?`;
      }
    } else directReply = 'Qual é o nome dele?';
  } else if (isSpeciesQuestion(lastAssistant) && affirmative) {
    directReply = petNameFromHistory
      ? `Claro! O ${petNameFromHistory} é cãozinho ou gatinho?`
      : 'Claro! Ele é cãozinho ou gatinho?';
  } else if (isSpeciesQuestion(lastAssistant) && (currentType === 'dogs' || currentType === 'cats')) {
    const name = petNameFromHistory;
    if (name) {
      const existing = context.pets.find((pet) => pet.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
      if (!existing) {
        createPet = { fields: { name, type: currentType }, sourceQuote: message.trim() };
        directReply = `Entendi: ${name} é ${currentType === 'dogs' ? 'cão' : 'gato'}. Preparei o cadastro; confira e confirme no botão abaixo.`;
      } else {
        directReply = `${name} já consta no seu cadastro. Posso ajudar com alguma informação sobre ele?`;
      }
    } else {
      directReply = `Entendi! É ${currentType === 'dogs' ? 'cãozinho' : 'gatinho'}. Como ele se chama?`;
    }
  } else if (isSpeciesQuestion(lastAssistant)) {
    directReply = 'Só para eu entender: ele é cãozinho ou gatinho?';
  }
  const previousProductQuery = [...userHistory].reverse().map(productQuery).find(Boolean) || null;
  const isShortAnswer = message.trim().length <= 60 && !declined && !closing;
  const query = directQuery || (!askedForOfferDetails && isShortAnswer && lastAssistant.includes('?') ? previousProductQuery : null);
  const hasType = petType !== 'all' || Boolean(mentionedPetType(conversation));
  const hasName = context.pets.length > 0 || /\b(?:se chama|chama-se|chamado|chamada|nome dele|nome dela)\s+[\p{L}]+/iu.test(conversation)
    || /\b(?:meu|minha)\s+(?:cachorro|c[aã]o|gato|pet)\s+(?:é\s+o\s+|é\s+a\s+)?[A-ZÀ-Ý][\p{L}]{1,}/u.test(conversation);
  const answeringNameQuestion = /\b(nome|chama)\b/i.test(lastAssistant) && lastAssistant.includes('?');
  const askName = hasType && !hasName && !declined && !closing && !(isShortAnswer && answeringNameQuestion);

  return {
    search: query ? { query, petType } : null,
    askName,
    greetingOnly,
    directReply,
    createPet,
    updatePet,
  };
}
