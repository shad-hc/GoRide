const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RideHail API',
      version: '1.0.0',
      description: `
## GoRide — Real-time Ride-Hailing Platform API

### Authentication
All protected endpoints require a **Bearer JWT token** in the Authorization header.

### Real-time Events
Connect to the Socket.IO server at \`ws://host:5000\` with \`auth: { token: "<jwt>" }\`.
      `,
      contact: { name: 'RideHail Team', email: 'api@ridehail.io' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['passenger', 'driver', 'admin'] },
            phone: { type: 'string' },
            rating: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Ride: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            passengerId: { type: 'string' },
            driverId: { type: 'string' },
            pickupLocation: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                coordinates: { type: 'array', items: { type: 'number' } },
              },
            },
            dropoffLocation: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                coordinates: { type: 'array', items: { type: 'number' } },
              },
            },
            status: {
              type: 'string',
              enum: ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'],
            },
            fare: { type: 'number' },
            distanceKm: { type: 'number' },
            estimatedDurationMin: { type: 'number' },
          },
        },
        Rating: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            rideId: { type: 'string' },
            raterId: { type: 'string' },
            ratedUserId: { type: 'string' },
            score: { type: 'number', minimum: 1, maximum: 5 },
            comment: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
