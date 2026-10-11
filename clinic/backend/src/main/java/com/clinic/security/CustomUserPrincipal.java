package com.clinic.security;

import com.clinic.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Getter
public class CustomUserPrincipal implements UserDetails {

    private final User user;

    public CustomUserPrincipal(User user) {
        this.user = user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Role authorities (new name plus legacy alias) drive hasRole(...) checks.
        List<GrantedAuthority> authorities = new ArrayList<>(
                RolePermissions.authoritiesFor(user.getRole()).stream()
                        .map(SimpleGrantedAuthority::new)
                        .toList());

        // Permission authorities drive hasAuthority('PERM_...') checks, so a new
        // role never requires editing a @PreAuthorize expression.
        RolePermissions.forRole(user.getRole()).stream()
                .map(permission -> new SimpleGrantedAuthority("PERM_" + permission))
                .forEach(authorities::add);

        return List.copyOf(authorities);
    }

    public String getUserId() {
        return user.getId();
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.getActive();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.getActive();
    }
}