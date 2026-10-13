export const sampleQuestions = [
  // JEE MAINS - Physics
  {
    id: 'jm-phy-001',
    exam: 'JEE MAINS',
    subject: 'Physics',
    chapter: 'Mechanics',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'A particle of mass 2 kg is moving with a velocity of 3 m/s. What is its kinetic energy?',
    options: {
      A: '6 J',
      B: '9 J',
      C: '12 J',
      D: '18 J'
    },
    correct_answer: 'B',
    explanation: 'Kinetic Energy = (1/2)mv² = (1/2)(2)(3²) = 9 J'
  },
  {
    id: 'jm-phy-002',
    exam: 'JEE MAINS',
    subject: 'Physics',
    chapter: 'Electromagnetism',
    difficulty: 'Hard',
    year: 2023,
    question_text: 'The magnetic field at the center of a circular coil of radius R carrying current I is B. What will be the magnetic field at the center if the radius is doubled and current is halved?',
    options: {
      A: 'B/4',
      B: 'B/2',
      C: 'B',
      D: '2B'
    },
    correct_answer: 'A',
    explanation: 'B ∝ I/R. New B = (I/2)/(2R) = B/4'
  },
  {
    id: 'jm-phy-003',
    exam: 'JEE MAINS',
    subject: 'Physics',
    chapter: 'Thermodynamics',
    difficulty: 'Easy',
    year: 2024,
    question_text: 'In an isothermal process, which quantity remains constant?',
    options: {
      A: 'Pressure',
      B: 'Volume',
      C: 'Temperature',
      D: 'Internal Energy'
    },
    correct_answer: 'C',
    explanation: 'Isothermal means constant temperature process.'
  },
  {
    id: 'jm-phy-004',
    exam: 'JEE MAINS',
    subject: 'Physics',
    chapter: 'Optics',
    difficulty: 'Medium',
    year: 2023,
    question_text: 'A convex lens of focal length 20 cm forms an image at 40 cm. What is the object distance?',
    options: {
      A: '20 cm',
      B: '30 cm',
      C: '40 cm',
      D: '60 cm'
    },
    correct_answer: 'C',
    explanation: 'Using lens formula: 1/f = 1/v - 1/u, we get u = 40 cm'
  },
  {
    id: 'jm-phy-005',
    exam: 'JEE MAINS',
    subject: 'Physics',
    chapter: 'Modern Physics',
    difficulty: 'Hard',
    year: 2022,
    question_text: 'The de Broglie wavelength of an electron accelerated through a potential difference of 100 V is approximately:',
    options: {
      A: '0.12 nm',
      B: '1.2 nm',
      C: '12 nm',
      D: '120 nm'
    },
    correct_answer: 'A',
    explanation: 'λ = h/√(2meV) ≈ 0.12 nm for V = 100V'
  },

  // JEE MAINS - Chemistry
  {
    id: 'jm-chem-001',
    exam: 'JEE MAINS',
    subject: 'Chemistry',
    chapter: 'Organic Chemistry',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'Which of the following is the most stable carbocation?',
    options: {
      A: 'Primary',
      B: 'Secondary',
      C: 'Tertiary',
      D: 'Methyl'
    },
    correct_answer: 'C',
    explanation: 'Tertiary carbocations are most stable due to hyperconjugation and inductive effects.'
  },
  {
    id: 'jm-chem-002',
    exam: 'JEE MAINS',
    subject: 'Chemistry',
    chapter: 'Inorganic Chemistry',
    difficulty: 'Easy',
    year: 2023,
    question_text: 'What is the oxidation state of Cr in K₂Cr₂O₇?',
    options: {
      A: '+3',
      B: '+4',
      C: '+6',
      D: '+7'
    },
    correct_answer: 'C',
    explanation: '2(+1) + 2x + 7(-2) = 0, solving gives x = +6'
  },
  {
    id: 'jm-chem-003',
    exam: 'JEE MAINS',
    subject: 'Chemistry',
    chapter: 'Physical Chemistry',
    difficulty: 'Hard',
    year: 2024,
    question_text: 'The pH of 0.001 M HCl solution is:',
    options: {
      A: '1',
      B: '2',
      C: '3',
      D: '4'
    },
    correct_answer: 'C',
    explanation: 'pH = -log[H⁺] = -log(0.001) = 3'
  },

  // JEE MAINS - Mathematics
  {
    id: 'jm-math-001',
    exam: 'JEE MAINS',
    subject: 'Mathematics',
    chapter: 'Calculus',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'What is the derivative of sin(x²)?',
    options: {
      A: 'cos(x²)',
      B: '2x cos(x²)',
      C: 'x cos(x²)',
      D: '2 cos(x²)'
    },
    correct_answer: 'B',
    explanation: 'Using chain rule: d/dx[sin(x²)] = cos(x²) · 2x'
  },
  {
    id: 'jm-math-002',
    exam: 'JEE MAINS',
    subject: 'Mathematics',
    chapter: 'Algebra',
    difficulty: 'Easy',
    year: 2023,
    question_text: 'If x² - 5x + 6 = 0, what are the roots?',
    options: {
      A: '1, 6',
      B: '2, 3',
      C: '-2, -3',
      D: '1, 5'
    },
    correct_answer: 'B',
    explanation: 'Factoring: (x-2)(x-3) = 0, roots are 2 and 3'
  },
  {
    id: 'jm-math-003',
    exam: 'JEE MAINS',
    subject: 'Mathematics',
    chapter: 'Coordinate Geometry',
    difficulty: 'Hard',
    year: 2022,
    question_text: 'The equation of the circle with center (3, 4) and radius 5 is:',
    options: {
      A: '(x-3)² + (y-4)² = 25',
      B: '(x+3)² + (y+4)² = 25',
      C: 'x² + y² = 25',
      D: '(x-3)² + (y-4)² = 5'
    },
    correct_answer: 'A',
    explanation: 'Circle equation: (x-h)² + (y-k)² = r²'
  },

  // NEET - Biology
  {
    id: 'neet-bio-001',
    exam: 'NEET',
    subject: 'Biology',
    chapter: 'Cell Biology',
    difficulty: 'Easy',
    year: 2024,
    question_text: 'Which organelle is known as the powerhouse of the cell?',
    options: {
      A: 'Nucleus',
      B: 'Mitochondria',
      C: 'Ribosome',
      D: 'Golgi apparatus'
    },
    correct_answer: 'B',
    explanation: 'Mitochondria produce ATP through cellular respiration.'
  },
  {
    id: 'neet-bio-002',
    exam: 'NEET',
    subject: 'Biology',
    chapter: 'Genetics',
    difficulty: 'Medium',
    year: 2023,
    question_text: 'In a dihybrid cross, what is the phenotypic ratio in F2 generation?',
    options: {
      A: '3:1',
      B: '1:2:1',
      C: '9:3:3:1',
      D: '1:1:1:1'
    },
    correct_answer: 'C',
    explanation: 'Dihybrid cross gives 9:3:3:1 phenotypic ratio in F2.'
  },
  {
    id: 'neet-bio-003',
    exam: 'NEET',
    subject: 'Biology',
    chapter: 'Human Physiology',
    difficulty: 'Hard',
    year: 2024,
    question_text: 'Which hormone regulates blood calcium levels?',
    options: {
      A: 'Insulin',
      B: 'Thyroxine',
      C: 'Parathormone',
      D: 'Adrenaline'
    },
    correct_answer: 'C',
    explanation: 'Parathormone (PTH) regulates calcium homeostasis.'
  },
  {
    id: 'neet-bio-004',
    exam: 'NEET',
    subject: 'Biology',
    chapter: 'Ecology',
    difficulty: 'Medium',
    year: 2023,
    question_text: 'What percentage of energy is transferred from one trophic level to the next?',
    options: {
      A: '5%',
      B: '10%',
      C: '20%',
      D: '50%'
    },
    correct_answer: 'B',
    explanation: 'Only about 10% of energy is transferred between trophic levels.'
  },

  // NEET - Physics
  {
    id: 'neet-phy-001',
    exam: 'NEET',
    subject: 'Physics',
    chapter: 'Mechanics',
    difficulty: 'Easy',
    year: 2024,
    question_text: 'The SI unit of force is:',
    options: {
      A: 'Joule',
      B: 'Newton',
      C: 'Watt',
      D: 'Pascal'
    },
    correct_answer: 'B',
    explanation: 'Newton (N) is the SI unit of force.'
  },
  {
    id: 'neet-phy-002',
    exam: 'NEET',
    subject: 'Physics',
    chapter: 'Electricity',
    difficulty: 'Medium',
    year: 2023,
    question_text: 'Two resistors of 4Ω and 6Ω are connected in parallel. What is the equivalent resistance?',
    options: {
      A: '2.4Ω',
      B: '5Ω',
      C: '10Ω',
      D: '24Ω'
    },
    correct_answer: 'A',
    explanation: '1/R = 1/4 + 1/6 = 5/12, R = 2.4Ω'
  },

  // NEET - Chemistry
  {
    id: 'neet-chem-001',
    exam: 'NEET',
    subject: 'Chemistry',
    chapter: 'Organic Chemistry',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'The functional group in alcohols is:',
    options: {
      A: '-COOH',
      B: '-OH',
      C: '-CHO',
      D: '-NH₂'
    },
    correct_answer: 'B',
    explanation: 'Alcohols contain the hydroxyl (-OH) functional group.'
  },
  {
    id: 'neet-chem-002',
    exam: 'NEET',
    subject: 'Chemistry',
    chapter: 'Periodic Table',
    difficulty: 'Easy',
    year: 2023,
    question_text: 'Which element has atomic number 6?',
    options: {
      A: 'Oxygen',
      B: 'Nitrogen',
      C: 'Carbon',
      D: 'Boron'
    },
    correct_answer: 'C',
    explanation: 'Carbon has atomic number 6.'
  },

  // JEE ADVANCED - Physics
  {
    id: 'ja-phy-001',
    exam: 'JEE ADVANCED',
    subject: 'Physics',
    chapter: 'Quantum Mechanics',
    difficulty: 'Hard',
    year: 2024,
    question_text: 'The uncertainty in position and momentum of a particle are equal. What is the uncertainty in position?',
    options: {
      A: 'ℏ/2',
      B: '√(ℏ/2)',
      C: 'ℏ',
      D: '2ℏ'
    },
    correct_answer: 'B',
    explanation: 'From Heisenberg uncertainty principle: Δx·Δp ≥ ℏ/2, if Δx = Δp, then Δx = √(ℏ/2)'
  },
  {
    id: 'ja-phy-002',
    exam: 'JEE ADVANCED',
    subject: 'Physics',
    chapter: 'Electrodynamics',
    difficulty: 'Hard',
    year: 2023,
    question_text: 'A charged particle moves in a uniform magnetic field. The path is:',
    options: {
      A: 'Straight line',
      B: 'Parabola',
      C: 'Circle',
      D: 'Ellipse'
    },
    correct_answer: 'C',
    explanation: 'Lorentz force provides centripetal acceleration, resulting in circular motion.'
  },

  // JEE ADVANCED - Chemistry
  {
    id: 'ja-chem-001',
    exam: 'JEE ADVANCED',
    subject: 'Chemistry',
    chapter: 'Chemical Kinetics',
    difficulty: 'Hard',
    year: 2024,
    question_text: 'For a first-order reaction, the half-life is:',
    options: {
      A: 'Proportional to initial concentration',
      B: 'Independent of initial concentration',
      C: 'Inversely proportional to initial concentration',
      D: 'Proportional to square of concentration'
    },
    correct_answer: 'B',
    explanation: 'For first-order reactions, t₁/₂ = 0.693/k, independent of concentration.'
  },

  // JEE ADVANCED - Mathematics
  {
    id: 'ja-math-001',
    exam: 'JEE ADVANCED',
    subject: 'Mathematics',
    chapter: 'Complex Numbers',
    difficulty: 'Hard',
    year: 2024,
    question_text: 'If z = 1 + i, what is |z²|?',
    options: {
      A: '1',
      B: '√2',
      C: '2',
      D: '2√2'
    },
    correct_answer: 'C',
    explanation: 'z² = (1+i)² = 2i, |z²| = 2'
  },

  // MHTCET - Physics
  {
    id: 'mht-phy-001',
    exam: 'MHTCET',
    subject: 'Physics',
    chapter: 'Mechanics',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'A body of mass 5 kg is moving with acceleration 2 m/s². What is the force?',
    options: {
      A: '5 N',
      B: '7 N',
      C: '10 N',
      D: '15 N'
    },
    correct_answer: 'C',
    explanation: 'F = ma = 5 × 2 = 10 N'
  },
  {
    id: 'mht-phy-002',
    exam: 'MHTCET',
    subject: 'Physics',
    chapter: 'Waves',
    difficulty: 'Easy',
    year: 2023,
    question_text: 'The speed of sound in air at 0°C is approximately:',
    options: {
      A: '300 m/s',
      B: '330 m/s',
      C: '360 m/s',
      D: '400 m/s'
    },
    correct_answer: 'B',
    explanation: 'Speed of sound in air at 0°C is approximately 330 m/s.'
  },

  // MHTCET - Chemistry
  {
    id: 'mht-chem-001',
    exam: 'MHTCET',
    subject: 'Chemistry',
    chapter: 'Thermodynamics',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'For an exothermic reaction, ΔH is:',
    options: {
      A: 'Positive',
      B: 'Negative',
      C: 'Zero',
      D: 'Infinite'
    },
    correct_answer: 'B',
    explanation: 'Exothermic reactions release heat, so ΔH < 0.'
  },

  // MHTCET - Mathematics
  {
    id: 'mht-math-001',
    exam: 'MHTCET',
    subject: 'Mathematics',
    chapter: 'Trigonometry',
    difficulty: 'Easy',
    year: 2024,
    question_text: 'What is the value of sin(90°)?',
    options: {
      A: '0',
      B: '1',
      C: '√2/2',
      D: '√3/2'
    },
    correct_answer: 'B',
    explanation: 'sin(90°) = 1'
  },
  {
    id: 'mht-math-002',
    exam: 'MHTCET',
    subject: 'Mathematics',
    chapter: 'Probability',
    difficulty: 'Medium',
    year: 2023,
    question_text: 'A coin is tossed twice. What is the probability of getting at least one head?',
    options: {
      A: '1/4',
      B: '1/2',
      C: '3/4',
      D: '1'
    },
    correct_answer: 'C',
    explanation: 'P(at least one head) = 1 - P(no heads) = 1 - 1/4 = 3/4'
  },

  // BITSAT - Physics
  {
    id: 'bit-phy-001',
    exam: 'BITSAT',
    subject: 'Physics',
    chapter: 'Rotational Motion',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'The moment of inertia of a solid sphere about its diameter is:',
    options: {
      A: 'MR²',
      B: '(2/5)MR²',
      C: '(2/3)MR²',
      D: '(1/2)MR²'
    },
    correct_answer: 'B',
    explanation: 'For a solid sphere, I = (2/5)MR²'
  },
  {
    id: 'bit-phy-002',
    exam: 'BITSAT',
    subject: 'Physics',
    chapter: 'Gravitation',
    difficulty: 'Hard',
    year: 2023,
    question_text: 'The escape velocity from Earth is approximately:',
    options: {
      A: '7.9 km/s',
      B: '9.8 km/s',
      C: '11.2 km/s',
      D: '15.0 km/s'
    },
    correct_answer: 'C',
    explanation: 'Escape velocity from Earth is approximately 11.2 km/s.'
  },

  // BITSAT - Chemistry
  {
    id: 'bit-chem-001',
    exam: 'BITSAT',
    subject: 'Chemistry',
    chapter: 'Electrochemistry',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'The standard hydrogen electrode has a potential of:',
    options: {
      A: '-1 V',
      B: '0 V',
      C: '+1 V',
      D: '+2 V'
    },
    correct_answer: 'B',
    explanation: 'By convention, SHE has a potential of 0 V.'
  },

  // BITSAT - Mathematics
  {
    id: 'bit-math-001',
    exam: 'BITSAT',
    subject: 'Mathematics',
    chapter: 'Matrices',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'If A is a 3×3 matrix and |A| = 5, what is |2A|?',
    options: {
      A: '10',
      B: '20',
      C: '40',
      D: '125'
    },
    correct_answer: 'C',
    explanation: '|kA| = k^n|A| for n×n matrix, so |2A| = 2³ × 5 = 40'
  },

  // COMEDK - Physics
  {
    id: 'com-phy-001',
    exam: 'COMEDK',
    subject: 'Physics',
    chapter: 'Fluid Mechanics',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'According to Bernoulli\'s equation, when velocity increases, pressure:',
    options: {
      A: 'Increases',
      B: 'Decreases',
      C: 'Remains constant',
      D: 'Becomes zero'
    },
    correct_answer: 'B',
    explanation: 'From Bernoulli\'s principle, P + (1/2)ρv² + ρgh = constant'
  },
  {
    id: 'com-phy-002',
    exam: 'COMEDK',
    subject: 'Physics',
    chapter: 'Semiconductors',
    difficulty: 'Hard',
    year: 2023,
    question_text: 'In a p-n junction diode, the depletion region is formed due to:',
    options: {
      A: 'Diffusion of majority carriers',
      B: 'Drift of minority carriers',
      C: 'Recombination of electrons and holes',
      D: 'External voltage'
    },
    correct_answer: 'A',
    explanation: 'Depletion region forms due to diffusion of majority carriers across the junction.'
  },

  // COMEDK - Chemistry
  {
    id: 'com-chem-001',
    exam: 'COMEDK',
    subject: 'Chemistry',
    chapter: 'Chemical Bonding',
    difficulty: 'Easy',
    year: 2024,
    question_text: 'The shape of NH₃ molecule is:',
    options: {
      A: 'Linear',
      B: 'Trigonal planar',
      C: 'Pyramidal',
      D: 'Tetrahedral'
    },
    correct_answer: 'C',
    explanation: 'NH₃ has pyramidal shape due to one lone pair on nitrogen.'
  },
  {
    id: 'com-chem-002',
    exam: 'COMEDK',
    subject: 'Chemistry',
    chapter: 'Solutions',
    difficulty: 'Medium',
    year: 2023,
    question_text: 'Molarity is defined as:',
    options: {
      A: 'Moles of solute per kg of solvent',
      B: 'Moles of solute per liter of solution',
      C: 'Mass of solute per liter of solution',
      D: 'Moles of solute per liter of solvent'
    },
    correct_answer: 'B',
    explanation: 'Molarity = moles of solute / liters of solution'
  },

  // COMEDK - Mathematics
  {
    id: 'com-math-001',
    exam: 'COMEDK',
    subject: 'Mathematics',
    chapter: 'Vectors',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'If |a| = 3 and |b| = 4, and a·b = 6, what is the angle between them?',
    options: {
      A: '30°',
      B: '45°',
      C: '60°',
      D: '90°'
    },
    correct_answer: 'C',
    explanation: 'a·b = |a||b|cosθ, so cosθ = 6/(3×4) = 1/2, θ = 60°'
  },
  {
    id: 'com-math-002',
    exam: 'COMEDK',
    subject: 'Mathematics',
    chapter: 'Limits',
    difficulty: 'Hard',
    year: 2023,
    question_text: 'What is lim(x→0) (sin x)/x?',
    options: {
      A: '0',
      B: '1',
      C: '∞',
      D: 'Does not exist'
    },
    correct_answer: 'B',
    explanation: 'This is a standard limit: lim(x→0) (sin x)/x = 1'
  },

  // Additional questions for variety
  {
    id: 'jm-phy-006',
    exam: 'JEE MAINS',
    subject: 'Physics',
    chapter: 'Waves',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'The wavelength of a wave with frequency 500 Hz and speed 340 m/s is:',
    options: {
      A: '0.34 m',
      B: '0.68 m',
      C: '1.47 m',
      D: '170 m'
    },
    correct_answer: 'B',
    explanation: 'λ = v/f = 340/500 = 0.68 m'
  },
  {
    id: 'neet-bio-005',
    exam: 'NEET',
    subject: 'Biology',
    chapter: 'Plant Physiology',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'Photosynthesis primarily occurs in which part of the leaf?',
    options: {
      A: 'Epidermis',
      B: 'Mesophyll',
      C: 'Vascular bundle',
      D: 'Cuticle'
    },
    correct_answer: 'B',
    explanation: 'Mesophyll cells contain chloroplasts where photosynthesis occurs.'
  },
  {
    id: 'ja-math-002',
    exam: 'JEE ADVANCED',
    subject: 'Mathematics',
    chapter: 'Differential Equations',
    difficulty: 'Hard',
    year: 2023,
    question_text: 'The order and degree of the differential equation d²y/dx² + (dy/dx)³ = 0 are:',
    options: {
      A: '2, 1',
      B: '2, 3',
      C: '3, 2',
      D: '1, 3'
    },
    correct_answer: 'A',
    explanation: 'Order is 2 (highest derivative), degree is 1 (power of highest derivative).'
  },
  {
    id: 'mht-bio-001',
    exam: 'MHTCET',
    subject: 'Biology',
    chapter: 'Biotechnology',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'PCR is used for:',
    options: {
      A: 'DNA sequencing',
      B: 'DNA amplification',
      C: 'Protein synthesis',
      D: 'Cell culture'
    },
    correct_answer: 'B',
    explanation: 'PCR (Polymerase Chain Reaction) amplifies DNA sequences.'
  },
  {
    id: 'bit-phy-003',
    exam: 'BITSAT',
    subject: 'Physics',
    chapter: 'Capacitance',
    difficulty: 'Medium',
    year: 2024,
    question_text: 'Two capacitors of 2μF and 3μF are connected in series. The equivalent capacitance is:',
    options: {
      A: '1.2μF',
      B: '2.5μF',
      C: '5μF',
      D: '6μF'
    },
    correct_answer: 'A',
    explanation: '1/C = 1/2 + 1/3 = 5/6, C = 1.2μF'
  },
  {
    id: 'com-chem-003',
    exam: 'COMEDK',
    subject: 'Chemistry',
    chapter: 'Coordination Compounds',
    difficulty: 'Hard',
    year: 2024,
    question_text: 'The coordination number of Fe in [Fe(CN)₆]³⁻ is:',
    options: {
      A: '3',
      B: '4',
      C: '6',
      D: '8'
    },
    correct_answer: 'C',
    explanation: 'Six CN⁻ ligands coordinate with Fe, so coordination number is 6.'
  }
];

export function seedQuestionsToLocalStorage() {
  const seeded = localStorage.getItem('impulse_seeded');
  const legacySeeded = localStorage.getItem('examforge_seeded');

  if (!seeded && legacySeeded) {
    const legacyQuestions = localStorage.getItem('examforge_questions');
    if (legacyQuestions && !localStorage.getItem('impulse_questions')) {
      localStorage.setItem('impulse_questions', legacyQuestions);
    }
    localStorage.setItem('impulse_seeded', 'true');
    return;
  }

  if (!seeded) {
    localStorage.setItem('impulse_questions', JSON.stringify(sampleQuestions));
    localStorage.setItem('impulse_seeded', 'true');
    console.log('Questions seeded to localStorage');
  }
}