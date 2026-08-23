import { registerDecorator, type ValidationOptions } from 'class-validator';

const US_DATETIME_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;

export function parseUsDateTime(value: string): Date | undefined {
  const match = US_DATETIME_PATTERN.exec(value);
  if (!match) return undefined;

  const [, month, day, year, hours, minutes] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)),
  );

  const valid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hours) &&
    date.getUTCMinutes() === Number(minutes);

  return valid ? date : undefined;
}

export function IsUsDateTime(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isUsDateTime',
      target: object.constructor,
      propertyName,
      options: {
        message: 'must be a valid date in MM/DD/YYYY HH:mm format',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && parseUsDateTime(value) !== undefined;
        },
      },
    });
  };
}
