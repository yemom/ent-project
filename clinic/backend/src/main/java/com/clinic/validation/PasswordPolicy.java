package com.clinic.validation;

public final class PasswordPolicy {

    public static final String REGEX =
            "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*?&#^()_\\-+=\\[\\]{}:;\"'.,<>~/\\\\|]).{8,}$";

    public static final String MESSAGE =
            "Password must be at least 8 characters and include a letter, a number, and a special character";

    private PasswordPolicy() {
    }

    public static boolean isValid(String password) {
        return password != null && password.matches(REGEX);
    }
}
