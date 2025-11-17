import * as Yup from 'yup';

// Паттерн для базовой фильтрации SQL-инъекций
const forbiddenPattern = /(--|;|'|"|\/\*|\*\/|DROP|SELECT|INSERT|DELETE|UPDATE)/i;

export const ContactsFormSchema = Yup.object().shape({
  name: Yup.string()
    .required('Имя обязательно!')
    .max(30, 'Имя слишком длинное!')
    .test('no-sql-injection', 'Имя содержит недопустимые символы!', value =>
      value ? !forbiddenPattern.test(value) : true
    ),
  email: Yup.string()
    .required('Email обязателен!')
    .email('Некорректный формат email!')
    .test('no-sql-injection', 'Email содержит недопустимые символы!', value =>
      value ? !forbiddenPattern.test(value) : true
    ),
  message: Yup.string()
    .required('Сообщение обязательно!')
    .max(1000, 'Сообщение слишком длинное!')
    .test('no-sql-injection', 'Сообщение содержит недопустимые символы', value =>
      value ? !forbiddenPattern.test(value) : true
    ),
});
