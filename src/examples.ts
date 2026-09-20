/**
 * The sketches the header's `<select>` offers. Four, because four is what it
 * takes to show the notation: a catalogue of systems and references, an enum
 * and a `~` relation, inheritance, and a sketch that is mostly still
 * questions. The first one loads on a fresh visit.
 *
 * Every example compiles without an error diagnostic; `tests/examples.test.ts`
 * is what keeps that true.
 *
 * They are written with four spaces of indentation, which is what the editor's
 * Tab inserts, so a line typed under an example lines up with it.
 */

export interface Example {
  /** The value of the `<option>`, and what a failing test names. */
  id: string;
  /** What the option reads as. */
  name: string;
  source: string;
}

const CATALOGUE: Example = {
  id: 'catalogue',
  name: 'Star Wars catalogue',
  source: `Character @Catalog     # Someone in the films
    id*
    name
    homeworld: Planet
    species: human|droid|wookiee   ? More?

Planet @Catalog
    id*
    name
    climate: arid|temperate|frozen

Jedi < Character
    rank: padawan|knight|master
`,
};

const LIBRARY: Example = {
  id: 'library',
  name: 'Library',
  source: `Book @Catalogue          # Anything a member can borrow
    isbn*
    title
    author: Author
    genre: fiction|nonfiction|reference|childrens
    copies: int

Author @Catalogue
    id*
    name
    born: date

Member @Circulation
    cardNumber*
    name
    email
    joined: date

Loan @Circulation        # One copy, one member, one date it is due back
    id*
    book: Book
    member: Member
    borrowed: date
    due: date
    state: open|returned|overdue

Borrower @Till ~ Member  # What the till knows about the same person
    cardNumber*
    balance: float
`,
};

const SHOP: Example = {
  id: 'shop',
  name: 'Shop with inheritance',
  source: `Product @Shop            # Everything in the catalogue is one of these
    sku*
    name
    price: float
    category: Category

Category @Shop
    id*
    name

DigitalProduct < Product @Shop
    downloadUrl: uri
    licence: single|team|site

PhysicalProduct < Product @Shop
    weightGrams: int
    shipsFrom: Warehouse

Warehouse @Logistics
    id*
    city
`,
};

const QUESTIONS: Example = {
  id: 'questions',
  name: 'A sketch full of doubts',
  source: `# A first pass over booking, written while the domain expert talked.
# Every ? is a question nobody in the room could answer.

Booking @Reservations      # One traveller on one departure
    reference*             # The code the traveller quotes  ? Six characters or eight?
    traveller: Traveller
    departure: Departure
    seat                   ? Is a seat a string, or a class of its own?
    status: held|paid|flown|refunded

Traveller @Reservations    ? Is this the same person the loyalty system knows?
    id*
    name                   # As it is printed on the ticket
    email

Departure @Timetable       # A flight on a date
    id*
    flightNumber
    departs: datetime
    origin: Airport
    destination: Airport   ? Do we need the gate here, or is that operations?

Airport @Timetable
    code*                  # IATA, three letters
    name
`,
};

export const EXAMPLES: readonly Example[] = [CATALOGUE, LIBRARY, SHOP, QUESTIONS];

/** What the page opens with on a fresh visit. */
export const DEFAULT_EXAMPLE: Example = CATALOGUE;
