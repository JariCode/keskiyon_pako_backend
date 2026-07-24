function stripDollarKeys(obj) {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      stripDollarKeys(obj[key]);
    }
  }
}

function sanitize(req, res, next) {
  stripDollarKeys(req.body);
  stripDollarKeys(req.params);

  // req.query on Express 5:ssä getter, joten sitä ei voi muokata paikallaan.
  // Puhdistetaan kopio ja korvataan getter sillä.
  //
  // HUOM: Expressin oletusparseri ('simple') ei luo sisäkkäisiä objekteja,
  // joten NoSQL-injektio ei onnistu tälläkään hetkellä. Tämä on
  // syvyyssuuntainen puolustus: suoja ei saa riippua siitä, ettei
  // 'query parser' -asetusta joskus vaihdeta 'extended'-arvoon.
  if (req.query && typeof req.query === 'object') {
    const cleanQuery = { ...req.query };
    stripDollarKeys(cleanQuery);
    Object.defineProperty(req, 'query', {
      value: cleanQuery,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  next();
}

module.exports = sanitize;
