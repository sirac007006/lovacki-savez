import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import bcrypt from 'bcrypt';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

// Database connection
const db = new pg.Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
});
db.connect();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'lovacki-savez-crne-gore-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 sata
}));

// Middleware za provjeru autentifikacije
function requireAuth(req, res, next) {
    if (req.session.admin) {
        next();
    } else {
        res.redirect('/login');
    }
}

// RUTE

// Login stranica
app.get('/login', (req, res) => {
    if (req.session.admin) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

// Login POST
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Username:', username);
    console.log('Password:', password);
    
    // Admin kredencijali - username: admin, password: admin123
    const adminUsername = 'admin';
    const adminPasswordHash = '$2a$12$qk6f/gC6MoUvGj8DCyhpn.i8EtkeVtqNYghzly.h8uxQC7Wgh14vm';
    
    console.log('Admin username match:', username === adminUsername);
    
    if (username === adminUsername) {
        try {
            const match = await bcrypt.compare(password, adminPasswordHash);
            console.log('Password match:', match);
            
            if (match) {
                req.session.admin = true;
                console.log('Login successful! Redirecting to /');
                return res.redirect('/');
            }
        } catch (err) {
            console.error('Bcrypt error:', err);
        }
    }
    
    console.log('Login failed - incorrect credentials');
    res.render('login', { error: 'Pogrešno korisničko ime ili lozinka' });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Početna stranica - Pregled dozvola sa paginacijom
app.get('/', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 1000;
        const offset = (page - 1) * limit;
        
        const countResult = await db.query('SELECT COUNT(*) FROM lovci');
        const totalRecords = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalRecords / limit);
        
        const result = await db.query(
            'SELECT * FROM lovci ORDER BY id DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        
        console.log(`=== PAGINATION INFO ===`);
        console.log(`Page: ${page}`);
        console.log(`Total Records: ${totalRecords}`);
        console.log(`Total Pages: ${totalPages}`);
        console.log(`Limit: ${limit}`);
        console.log(`Offset: ${offset}`);
        console.log(`Records on this page: ${result.rows.length}`);
        
        res.render('index', { 
            lovci: result.rows,
            currentPage: page,
            totalPages: totalPages,
            totalRecords: totalRecords
        });
    } catch (err) {
        console.error('Error on index page:', err);
        res.render('index', { 
            lovci: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0
        });
    }
});

// Stranica za dodavanje nove dozvole
app.get('/nova-dozvola', requireAuth, (req, res) => {
    res.render('nova-dozvola');
});

// POST za dodavanje nove dozvole
app.post('/nova-dozvola', requireAuth, async (req, res) => {
    const {
        broj_knjige,
        broj_stranice,
        redni_broj,
        ime,
        ocevo_ime,
        prezime,
        datum_rodjenja_d,
        datum_rodjenja_m,
        datum_rodjenja_g,
        mjesto_rodjenja,
        datum_prijave_d,
        datum_prijave_m,
        datum_prijave_g,
        broj_prijave,
        datum_polaganja_d,
        datum_polaganja_m,
        datum_polaganja_g,
        mjesto_polaganja,
        datum_izdatog_uvjerenja_d,
        datum_izdatog_uvjerenja_m,
        datum_izdatog_uvjerenja_g,
        djelovodni_broj,
        clan_lovacke_organizacije,
        opstina,
        drzava,
        jmbg,
        broj_uverenja
    } = req.body;

    const datum_rodjenja = `${datum_rodjenja_g}-${datum_rodjenja_m}-${datum_rodjenja_d}`;
    const datum_prijave = `${datum_prijave_g}-${datum_prijave_m}-${datum_prijave_d}`;
    const datum_polaganja = `${datum_polaganja_g}-${datum_polaganja_m}-${datum_polaganja_d}`;
    const datum_izdatog_uvjerenja = `${datum_izdatog_uvjerenja_g}-${datum_izdatog_uvjerenja_m}-${datum_izdatog_uvjerenja_d}`;

    try {
        await db.query(
            `INSERT INTO lovci (
                broj_knjige, broj_stranice, redni_broj, ime, ocevo_ime, prezime,
                datum_rodjenja, mjesto_rodjenja, datum_prijave, broj_prijave,
                datum_polaganja, mjesto_polaganja, datum_izdatog_uvjerenja,
                djelovodni_broj, clan_lovacke_organizacije, opstina,
                drzava, jmbg, broj_uverenja
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [
                broj_knjige, broj_stranice, redni_broj, ime, ocevo_ime, prezime,
                datum_rodjenja, mjesto_rodjenja, datum_prijave, broj_prijave,
                datum_polaganja, mjesto_polaganja, datum_izdatog_uvjerenja,
                djelovodni_broj, clan_lovacke_organizacije, opstina,
                drzava, jmbg, broj_uverenja
            ]
        );
        res.redirect('/?success=true');
    } catch (err) {
        console.error(err);
        res.render('nova-dozvola', { error: 'Greška pri dodavanju dozvole' });
    }
});

// POST pretraga sa paginacijom
app.post('/pretraga', requireAuth, async (req, res) => {
    const { search } = req.body;
    const page = parseInt(req.query.page) || 1;
    const limit = 1000;
    const offset = (page - 1) * limit;
    
    try {
        // Razdvoji pretragu na delove (reči)
        const searchTerms = search.trim().split(/\s+/);
        
        let query, countQuery;
        let params;
        
        if (searchTerms.length >= 2) {
            // Ako ima 2 ili više reči, pretraži kombinaciju ime+prezime ili prezime+ime
            const term1 = `%${searchTerms[0]}%`;
            const term2 = `%${searchTerms.slice(1).join(' ')}%`;
            
            countQuery = `SELECT COUNT(*) FROM lovci 
                WHERE (LOWER(ime) LIKE LOWER($1) AND LOWER(prezime) LIKE LOWER($2))
                OR (LOWER(prezime) LIKE LOWER($1) AND LOWER(ime) LIKE LOWER($2))
                OR LOWER(CONCAT(ime, ' ', prezime)) LIKE LOWER($3)
                OR LOWER(CONCAT(prezime, ' ', ime)) LIKE LOWER($3)
                OR LOWER(ime) LIKE LOWER($3)
                OR LOWER(prezime) LIKE LOWER($3)
                OR LOWER(ocevo_ime) LIKE LOWER($3)
                OR broj_knjige::text LIKE $3
                OR redni_broj::text LIKE $3
                OR LOWER(drzava) LIKE LOWER($3)
                OR LOWER(jmbg) LIKE LOWER($3)
                OR broj_uverenja::text LIKE $3`;
            
            query = `SELECT * FROM lovci 
                WHERE (LOWER(ime) LIKE LOWER($1) AND LOWER(prezime) LIKE LOWER($2))
                OR (LOWER(prezime) LIKE LOWER($1) AND LOWER(ime) LIKE LOWER($2))
                OR LOWER(CONCAT(ime, ' ', prezime)) LIKE LOWER($3)
                OR LOWER(CONCAT(prezime, ' ', ime)) LIKE LOWER($3)
                OR LOWER(ime) LIKE LOWER($3)
                OR LOWER(prezime) LIKE LOWER($3)
                OR LOWER(ocevo_ime) LIKE LOWER($3)
                OR broj_knjige::text LIKE $3
                OR redni_broj::text LIKE $3
                OR LOWER(drzava) LIKE LOWER($3)
                OR LOWER(jmbg) LIKE LOWER($3)
                OR broj_uverenja::text LIKE $3
                ORDER BY 
                    CASE 
                        WHEN LOWER(ime) LIKE LOWER($1) AND LOWER(prezime) LIKE LOWER($2) THEN 1
                        WHEN LOWER(prezime) LIKE LOWER($1) AND LOWER(ime) LIKE LOWER($2) THEN 2
                        ELSE 3
                    END,
                    id DESC
                LIMIT $4 OFFSET $5`;
            
            params = [term1, term2, `%${search}%`];
        } else {
            // Ako je jedna reč, standardna pretraga
            countQuery = `SELECT COUNT(*) FROM lovci 
                WHERE LOWER(ime) LIKE LOWER($1) 
                OR LOWER(prezime) LIKE LOWER($1)
                OR LOWER(ocevo_ime) LIKE LOWER($1)
                OR broj_knjige::text LIKE $1
                OR redni_broj::text LIKE $1
                OR LOWER(drzava) LIKE LOWER($1)
                OR LOWER(jmbg) LIKE LOWER($1)
                OR broj_uverenja::text LIKE $1`;
            
            query = `SELECT * FROM lovci 
                WHERE LOWER(ime) LIKE LOWER($1) 
                OR LOWER(prezime) LIKE LOWER($1)
                OR LOWER(ocevo_ime) LIKE LOWER($1)
                OR broj_knjige::text LIKE $1
                OR redni_broj::text LIKE $1
                OR LOWER(drzava) LIKE LOWER($1)
                OR LOWER(jmbg) LIKE LOWER($1)
                OR broj_uverenja::text LIKE $1
                ORDER BY id DESC
                LIMIT $2 OFFSET $3`;
            
            params = [`%${search}%`];
        }
        
        const countResult = await db.query(
            countQuery,
            searchTerms.length >= 2 ? params : params
        );
        const totalRecords = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalRecords / limit);
        
        const result = await db.query(
            query,
            searchTerms.length >= 2 ? [...params, limit, offset] : [...params, limit, offset]
        );
        
        res.render('pretraga', { 
            lovci: result.rows, 
            query: search,
            currentPage: page,
            totalPages: totalPages,
            totalRecords: totalRecords
        });
    } catch (err) {
        console.error(err);
        res.render('pretraga', { 
            lovci: [], 
            query: search,
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0
        });
    }
});

// GET pretraga sa paginacijom (za navigaciju kroz stranice)
app.get('/pretraga', requireAuth, async (req, res) => {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 1000;
    const offset = (page - 1) * limit;
    
    if (search) {
        try {
            const searchTerms = search.trim().split(/\s+/);
            
            let query, countQuery;
            let params;
            
            if (searchTerms.length >= 2) {
                const term1 = `%${searchTerms[0]}%`;
                const term2 = `%${searchTerms.slice(1).join(' ')}%`;
                
                countQuery = `SELECT COUNT(*) FROM lovci 
                    WHERE (LOWER(ime) LIKE LOWER($1) AND LOWER(prezime) LIKE LOWER($2))
                    OR (LOWER(prezime) LIKE LOWER($1) AND LOWER(ime) LIKE LOWER($2))
                    OR LOWER(CONCAT(ime, ' ', prezime)) LIKE LOWER($3)
                    OR LOWER(CONCAT(prezime, ' ', ime)) LIKE LOWER($3)
                    OR LOWER(ime) LIKE LOWER($3)
                    OR LOWER(prezime) LIKE LOWER($3)
                    OR LOWER(ocevo_ime) LIKE LOWER($3)
                    OR broj_knjige::text LIKE $3
                    OR redni_broj::text LIKE $3
                    OR LOWER(drzava) LIKE LOWER($3)
                    OR LOWER(jmbg) LIKE LOWER($3)
                    OR broj_uverenja::text LIKE $3`;
                
                query = `SELECT * FROM lovci 
                    WHERE (LOWER(ime) LIKE LOWER($1) AND LOWER(prezime) LIKE LOWER($2))
                    OR (LOWER(prezime) LIKE LOWER($1) AND LOWER(ime) LIKE LOWER($2))
                    OR LOWER(CONCAT(ime, ' ', prezime)) LIKE LOWER($3)
                    OR LOWER(CONCAT(prezime, ' ', ime)) LIKE LOWER($3)
                    OR LOWER(ime) LIKE LOWER($3)
                    OR LOWER(prezime) LIKE LOWER($3)
                    OR LOWER(ocevo_ime) LIKE LOWER($3)
                    OR broj_knjige::text LIKE $3
                    OR redni_broj::text LIKE $3
                    OR LOWER(drzava) LIKE LOWER($3)
                    OR LOWER(jmbg) LIKE LOWER($3)
                    OR broj_uverenja::text LIKE $3
                    ORDER BY 
                        CASE 
                            WHEN LOWER(ime) LIKE LOWER($1) AND LOWER(prezime) LIKE LOWER($2) THEN 1
                            WHEN LOWER(prezime) LIKE LOWER($1) AND LOWER(ime) LIKE LOWER($2) THEN 2
                            ELSE 3
                        END,
                        id DESC
                    LIMIT $4 OFFSET $5`;
                
                params = [term1, term2, `%${search}%`];
            } else {
                countQuery = `SELECT COUNT(*) FROM lovci 
                    WHERE LOWER(ime) LIKE LOWER($1) 
                    OR LOWER(prezime) LIKE LOWER($1)
                    OR LOWER(ocevo_ime) LIKE LOWER($1)
                    OR broj_knjige::text LIKE $1
                    OR redni_broj::text LIKE $1
                    OR LOWER(drzava) LIKE LOWER($1)
                    OR LOWER(jmbg) LIKE LOWER($1)
                    OR broj_uverenja::text LIKE $1`;
                
                query = `SELECT * FROM lovci 
                    WHERE LOWER(ime) LIKE LOWER($1) 
                    OR LOWER(prezime) LIKE LOWER($1)
                    OR LOWER(ocevo_ime) LIKE LOWER($1)
                    OR broj_knjige::text LIKE $1
                    OR redni_broj::text LIKE $1
                    OR LOWER(drzava) LIKE LOWER($1)
                    OR LOWER(jmbg) LIKE LOWER($1)
                    OR broj_uverenja::text LIKE $1
                    ORDER BY id DESC
                    LIMIT $2 OFFSET $3`;
                
                params = [`%${search}%`];
            }
            
            const countResult = await db.query(countQuery, params);
            const totalRecords = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalRecords / limit);
            
            const result = await db.query(
                query,
                searchTerms.length >= 2 ? [...params, limit, offset] : [...params, limit, offset]
            );
            
            res.render('pretraga', { 
                lovci: result.rows, 
                query: search,
                currentPage: page,
                totalPages: totalPages,
                totalRecords: totalRecords
            });
        } catch (err) {
            console.error(err);
            res.render('pretraga', { 
                lovci: null, 
                query: search,
                currentPage: 1,
                totalPages: 1,
                totalRecords: 0
            });
        }
    } else {
        res.render('pretraga', { 
            lovci: null, 
            query: '',
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0
        });
    }
});

// Detalji dozvole
app.get('/dozvola/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM lovci WHERE id = $1', [req.params.id]);
        if (result.rows.length > 0) {
            res.render('detalji', { lovac: result.rows[0] });
        } else {
            res.redirect('/');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Uređivanje dozvole
app.get('/uredi/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM lovci WHERE id = $1', [req.params.id]);
        if (result.rows.length > 0) {
            res.render('uredi', { lovac: result.rows[0] });
        } else {
            res.redirect('/');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// POST uređivanje
app.post('/uredi/:id', requireAuth, async (req, res) => {
    const {
        broj_knjige, broj_stranice, redni_broj, ime, ocevo_ime, prezime,
        datum_rodjenja_d, datum_rodjenja_m, datum_rodjenja_g, mjesto_rodjenja,
        datum_prijave_d, datum_prijave_m, datum_prijave_g, broj_prijave,
        datum_polaganja_d, datum_polaganja_m, datum_polaganja_g, mjesto_polaganja,
        datum_izdatog_uvjerenja_d, datum_izdatog_uvjerenja_m, datum_izdatog_uvjerenja_g,
        djelovodni_broj, clan_lovacke_organizacije, opstina,
        drzava, jmbg, broj_uverenja
    } = req.body;

    const datum_rodjenja = `${datum_rodjenja_g}-${datum_rodjenja_m}-${datum_rodjenja_d}`;
    const datum_prijave = `${datum_prijave_g}-${datum_prijave_m}-${datum_prijave_d}`;
    const datum_polaganja = `${datum_polaganja_g}-${datum_polaganja_m}-${datum_polaganja_d}`;
    const datum_izdatog_uvjerenja = `${datum_izdatog_uvjerenja_g}-${datum_izdatog_uvjerenja_m}-${datum_izdatog_uvjerenja_d}`;

    try {
        await db.query(
            `UPDATE lovci SET 
                broj_knjige = $1, broj_stranice = $2, redni_broj = $3, 
                ime = $4, ocevo_ime = $5, prezime = $6,
                datum_rodjenja = $7, mjesto_rodjenja = $8,
                datum_prijave = $9, broj_prijave = $10,
                datum_polaganja = $11, mjesto_polaganja = $12,
                datum_izdatog_uvjerenja = $13, djelovodni_broj = $14,
                clan_lovacke_organizacije = $15, opstina = $16,
                drzava = $17, jmbg = $18, broj_uverenja = $19
            WHERE id = $20`,
            [
                broj_knjige, broj_stranice, redni_broj, ime, ocevo_ime, prezime,
                datum_rodjenja, mjesto_rodjenja, datum_prijave, broj_prijave,
                datum_polaganja, mjesto_polaganja, datum_izdatog_uvjerenja,
                djelovodni_broj, clan_lovacke_organizacije, opstina,
                drzava, jmbg, broj_uverenja, req.params.id
            ]
        );
        res.redirect('/dozvola/' + req.params.id);
    } catch (err) {
        console.error(err);
        res.redirect('/uredi/' + req.params.id);
    }
});

// Brisanje dozvole
app.post('/obrisi/:id', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM lovci WHERE id = $1', [req.params.id]);
        res.redirect('/?deleted=true');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

app.listen(port, () => {
    console.log(`Server pokrenut na portu ${port}`);
});